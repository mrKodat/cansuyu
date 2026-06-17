import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Donor } from '@/types'
import { normalize, tokensFrom, stripUndefined } from '@/utils/search'

const COL = 'donors'
const ref = () => collection(db, COL)

export async function listDonors(max = 200): Promise<Donor[]> {
  const snap = await getDocs(query(ref(), orderBy('updatedAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Donor, 'id'>) }))
}

export async function searchDonors(term: string, max = 50): Promise<Donor[]> {
  const t = normalize(term)
  if (!t) return listDonors(max)
  const snap = await getDocs(
    query(ref(), where('searchTokens', 'array-contains', t.split(' ')[0]), limit(max))
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Donor, 'id'>) }))
}

export async function getDonor(id: string): Promise<Donor | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Donor, 'id'>) }
}

type Input = Omit<Donor, 'id' | 'searchTokens' | 'createdAt' | 'updatedAt'>

export async function createDonor(input: Input): Promise<string> {
  const payload = stripUndefined({
    ...input,
    searchTokens: tokensFrom(input.fullName, input.phone, input.email, input.nationalId, input.taxNumber, input.city),
  })
  const docRef = await addDoc(ref(), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateDonor(id: string, input: Partial<Input>): Promise<void> {
  const current = await getDonor(id)
  if (!current) throw new Error('Bağışçı bulunamadı')
  const merged = { ...current, ...input }
  const clean = stripUndefined({
    ...input,
    searchTokens: tokensFrom(merged.fullName, merged.phone, merged.email, merged.nationalId, merged.taxNumber, merged.city),
  })
  await updateDoc(doc(db, COL, id), { ...clean, updatedAt: serverTimestamp() })
}

export async function deleteDonor(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
