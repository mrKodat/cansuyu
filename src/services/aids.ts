import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Aid } from '@/types'
import { stripUndefined } from '@/utils/search'

const COL = 'aids'
const ref = () => collection(db, COL)

export async function listAids(max = 200): Promise<Aid[]> {
  const snap = await getDocs(query(ref(), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Aid, 'id'>) }))
}

export async function listAidsByBeneficiary(beneficiaryId: string): Promise<Aid[]> {
  // orderBy kullanmıyoruz — aksi halde composite index gerekir.
  // Bir muhtaç için yardım sayısı düşük olduğundan client-side sıralama yeterli.
  const snap = await getDocs(query(ref(), where('beneficiaryId', '==', beneficiaryId)))
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Aid, 'id'>) }))
  return items.sort((a, b) => {
    const ta = toMillis(a.deliveredAt) ?? toMillis(a.createdAt) ?? 0
    const tb = toMillis(b.deliveredAt) ?? toMillis(b.createdAt) ?? 0
    return tb - ta
  })
}

function toMillis(v: unknown): number | null {
  if (!v) return null
  if (v instanceof Date) return v.getTime()
  const maybe = v as { toMillis?: () => number; seconds?: number }
  if (typeof maybe.toMillis === 'function') return maybe.toMillis()
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000
  return null
}

export async function getAid(id: string): Promise<Aid | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Aid, 'id'>) }
}

type Input = Omit<Aid, 'id' | 'createdAt' | 'updatedAt'>

export async function createAid(input: Input): Promise<string> {
  const docRef = await addDoc(ref(), {
    ...stripUndefined(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateAid(id: string, input: Partial<Input>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...stripUndefined(input), updatedAt: serverTimestamp() })
}

export async function deleteAid(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
