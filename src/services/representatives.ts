import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Representative } from '@/types'
import { stripUndefined } from '@/utils/search'

const COL = 'users'

export async function listRepresentatives(): Promise<Representative[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('fullName')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Representative, 'id'>) }))
}

export async function getRepresentative(id: string): Promise<Representative | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Representative, 'id'>) }
}

export async function getRepresentativeByUid(uid: string): Promise<Representative | null> {
  const snap = await getDocs(query(collection(db, COL), where('uid', '==', uid), limit(1)))
  if (snap.empty) return null
  const d = snap.docs[0]!
  return { id: d.id, ...(d.data() as Omit<Representative, 'id'>) }
}

type Input = Omit<Representative, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>

export async function upsertRepresentative(input: Input): Promise<void> {
  await setDoc(
    doc(db, COL, input.uid),
    { ...stripUndefined(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function updateRepresentative(id: string, input: Partial<Input>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...stripUndefined(input), updatedAt: serverTimestamp() })
}

export async function touchLogin(uid: string): Promise<void> {
  await setDoc(doc(db, COL, uid), { lastLoginAt: serverTimestamp() }, { merge: true })
}

export async function deleteRepresentative(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
