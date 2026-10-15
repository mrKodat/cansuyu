import {
  collection, doc, getDocs, writeBatch,
  Timestamp, GeoPoint, DocumentReference, Bytes,
} from 'firebase/firestore'
import { db } from '@/firebase'

// Yedek dosyası biçimi, yaygın kullanılan `node-firestore-import-export` aracıyla aynıdır:
//
//   { "__collections__": { "<koleksiyon>": { "<docId>": { ...alanlar, "__collections__": {} } } } }
//
// Firestore'a özel tipler JSON'da şöyle tutulur:
//   { "__datatype__": "timestamp", "value": { "_seconds": 1700000000, "_nanoseconds": 0 } }
//   { "__datatype__": "geopoint", "value": { "_latitude": 38.67, "_longitude": 39.22 } }
//   { "__datatype__": "documentReference", "value": "beneficiaries/abc123" }
//   { "__datatype__": "bytes", "value": "<base64>" }
//
// Böylece dosya hem bu panelden hem de komut satırından geri yüklenebilir:
//   npx -p node-firestore-import-export firestore-import -a servis-hesabi.json -b yedek.json

export const BACKUP_COLLECTIONS = [
  'beneficiaries', 'aids', 'donors', 'inventory', 'inventoryMovements', 'applications', 'users',
] as const
export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number]

export const BackupCollectionLabels: Record<BackupCollection, string> = {
  beneficiaries: 'Muhtaçlar',
  aids: 'Yardımlar',
  donors: 'Bağışçılar',
  inventory: 'Envanter',
  inventoryMovements: 'Envanter Hareketleri',
  applications: 'Başvurular',
  users: 'Kullanıcılar / Temsilciler',
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type DocMap = Record<string, Record<string, Json>>
export interface BackupFile {
  __collections__: Record<string, DocMap>
  [k: string]: unknown
}

// Firestore'un tek seferde kabul ettiği en fazla yazma 500'dür; doküman boyutları
// büyük olabileceğinden (10 MiB istek sınırı) daha küçük paketler kullanıyoruz.
const BATCH_SIZE = 200

// ---- Dönüştürme ----

function serialize(value: unknown): Json {
  if (value === null || value === undefined) return null
  if (value instanceof Timestamp) {
    return { __datatype__: 'timestamp', value: { _seconds: value.seconds, _nanoseconds: value.nanoseconds } }
  }
  if (value instanceof Date) return serialize(Timestamp.fromDate(value))
  if (value instanceof GeoPoint) {
    return { __datatype__: 'geopoint', value: { _latitude: value.latitude, _longitude: value.longitude } }
  }
  if (value instanceof DocumentReference) return { __datatype__: 'documentReference', value: value.path }
  if (value instanceof Bytes) return { __datatype__: 'bytes', value: value.toBase64() }
  if (Array.isArray(value)) return value.map(serialize)
  if (typeof value === 'object') {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v)
    return out
  }
  return value as Json
}

function deserialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deserialize)
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.__datatype__ === 'string') {
      const v = o.value as Record<string, number> | string
      switch (o.__datatype__) {
        case 'timestamp': {
          const t = v as Record<string, number>
          return new Timestamp(t._seconds ?? t.seconds ?? 0, t._nanoseconds ?? t.nanoseconds ?? 0)
        }
        case 'geopoint': {
          const g = v as Record<string, number>
          return new GeoPoint(g._latitude ?? g.latitude ?? 0, g._longitude ?? g.longitude ?? 0)
        }
        case 'documentReference': return doc(db, v as string)
        case 'bytes': return Bytes.fromBase64String(v as string)
      }
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) out[k] = deserialize(v)
    return out
  }
  return value
}

// ---- Dışa aktarma ----

export async function exportBackup(
  collections: BackupCollection[],
  onProgress?: (collection: BackupCollection, count: number) => void,
): Promise<BackupFile> {
  const result: BackupFile = {
    __collections__: {},
    // Bilgi amaçlı; içe aktarma araçları "__" ile başlamayan üst düzey anahtarları yok sayar.
    meta: { app: 'cansuyu', exportedAt: new Date().toISOString(), version: 1 },
  }
  for (const name of collections) {
    const snap = await getDocs(collection(db, name))
    const docs: DocMap = {}
    snap.forEach((d) => {
      docs[d.id] = { ...(serialize(d.data()) as Record<string, Json>), __collections__: {} }
    })
    result.__collections__[name] = docs
    onProgress?.(name, snap.size)
  }
  return result
}

// ---- İçe aktarma ----

// Dosyayı okur ve biçimini kontrol eder. Hem `{ "__collections__": {...} }` hem de
// doğrudan `{ "beneficiaries": {...}, ... }` biçimini kabul eder.
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir JSON yedek dosyası değil.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dosya biçimi tanınmadı.')
  }
  const obj = data as Record<string, unknown>
  const cols = (obj.__collections__ && typeof obj.__collections__ === 'object')
    ? obj.__collections__ as Record<string, unknown>
    : Object.fromEntries(Object.entries(obj).filter(([k]) => (BACKUP_COLLECTIONS as readonly string[]).includes(k)))

  const known = Object.keys(cols).filter((k) => (BACKUP_COLLECTIONS as readonly string[]).includes(k))
  if (!known.length) {
    throw new Error('Dosyada bu panele ait bir koleksiyon bulunamadı (ör. beneficiaries, aids…).')
  }
  for (const k of known) {
    const c = cols[k]
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      throw new Error(`"${k}" koleksiyonu beklenen biçimde değil.`)
    }
  }
  return { ...obj, __collections__: cols as Record<string, DocMap> }
}

export function summarizeBackup(file: BackupFile): { name: BackupCollection; count: number }[] {
  return BACKUP_COLLECTIONS
    .filter((name) => file.__collections__[name])
    .map((name) => ({ name, count: Object.keys(file.__collections__[name] ?? {}).length }))
}

export type ImportMode = 'skip-existing' | 'overwrite'

export interface ImportResult { written: number; skipped: number }

export async function importBackup(
  file: BackupFile,
  collections: BackupCollection[],
  mode: ImportMode,
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, ImportResult>> {
  type Write = { path: string; data: Record<string, unknown>; col: string }
  // Bir koleksiyonun dokümanlarını (varsa alt koleksiyonlarıyla) düz yazma listesine çevirir
  const collect = (col: string, basePath: string, docs: DocMap, out: Write[]) => {
    for (const [id, raw] of Object.entries(docs)) {
      const { __collections__: sub, ...fields } = raw as Record<string, unknown>
      const path = `${basePath}/${id}`
      out.push({ path, data: deserialize(fields) as Record<string, unknown>, col })
      if (sub && typeof sub === 'object') {
        for (const [subName, subDocs] of Object.entries(sub as Record<string, DocMap>)) {
          collect(col, `${path}/${subName}`, subDocs, out)
        }
      }
    }
    return out
  }

  const results: Record<string, ImportResult> = {}
  const pending: Write[] = []

  for (const name of collections) {
    const docs = file.__collections__[name]
    if (!docs) continue
    results[name] = { written: 0, skipped: 0 }
    let writes = collect(name, name, docs, [])

    if (mode === 'skip-existing') {
      const existing = new Set((await getDocs(collection(db, name))).docs.map((d) => d.id))
      // Üst düzey doküman zaten varsa ona ve alt koleksiyonlarına dokunma
      const kept = writes.filter((w) => !existing.has(w.path.split('/')[1]!))
      results[name].skipped = writes.length - kept.length
      writes = kept
    }
    pending.push(...writes)
  }

  let done = 0
  onProgress?.(0, pending.length)
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const w of chunk) batch.set(doc(db, w.path), w.data)
    await batch.commit()
    for (const w of chunk) results[w.col]!.written++
    done += chunk.length
    onProgress?.(done, pending.length)
  }
  return results
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
