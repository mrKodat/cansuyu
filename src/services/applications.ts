import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Application, ApplicationStatus } from '@/types'
import { stripUndefined } from '@/utils/search'

const COL = 'applications'
const ref = () => collection(db, COL)

export async function listApplications(status?: ApplicationStatus, max = 200): Promise<Application[]> {
  // status + orderBy bileşik index gerektirir — filtreleme varken orderBy'ı client-side yapıyoruz.
  const q = status
    ? query(ref(), where('status', '==', status), limit(max))
    : query(ref(), orderBy('createdAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Application, 'id'>) }))
  if (status) {
    items.sort((a, b) => {
      const ta = toMillis(a.createdAt); const tb = toMillis(b.createdAt)
      return (tb ?? 0) - (ta ?? 0)
    })
  }
  return items
}

function toMillis(v: unknown): number | null {
  if (!v) return null
  if (v instanceof Date) return v.getTime()
  const m = v as { toMillis?: () => number; seconds?: number }
  if (typeof m.toMillis === 'function') return m.toMillis()
  if (typeof m.seconds === 'number') return m.seconds * 1000
  return null
}

export async function getApplication(id: string): Promise<Application | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Application, 'id'>) }
}

type Input = Omit<Application, 'id' | 'createdAt' | 'updatedAt'>

export async function createApplication(input: Input): Promise<string> {
  const docRef = await addDoc(ref(), {
    ...stripUndefined(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateApplication(id: string, input: Partial<Input>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...stripUndefined(input), updatedAt: serverTimestamp() })
}

export async function deleteApplication(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
