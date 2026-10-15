import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, getCountFromServer,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Beneficiary, NeedLevel } from '@/types'
import { normalize, tokensFrom, stripUndefined } from '@/utils/search'

const COL = 'beneficiaries'
const ref = () => collection(db, COL)

export async function listBeneficiaries(max = 200): Promise<Beneficiary[]> {
  const snap = await getDocs(query(ref(), orderBy('updatedAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) }))
}

// Sayım sunucu tarafında yapılır (aggregation query): dokümanlar indirilmez,
// bu yüzden kayıt sayısından bağımsız olarak doğru toplamı verir.
export async function countBeneficiaries(needLevel?: NeedLevel): Promise<number> {
  const q = needLevel ? query(ref(), where('needLevel', '==', needLevel)) : ref()
  const snap = await getCountFromServer(q)
  return snap.data().count
}

export async function searchBeneficiaries(term: string, max = 50): Promise<Beneficiary[]> {
  const t = normalize(term)
  if (!t) return listBeneficiaries(max)
  const snap = await getDocs(
    query(ref(), where('searchTokens', 'array-contains', t.split(' ')[0]), limit(max))
  )
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) }))
  const words = t.split(' ').filter(Boolean)
  return all.filter((b) => words.every((w) => b.searchTokens?.some((tok) => tok.startsWith(w))))
}

export async function getBeneficiary(id: string): Promise<Beneficiary | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Beneficiary, 'id'>) }
}

export async function findByNationalId(nationalId: string): Promise<Beneficiary | null> {
  const snap = await getDocs(query(ref(), where('nationalId', '==', nationalId), limit(1)))
  if (snap.empty) return null
  const d = snap.docs[0]!
  return { id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) }
}

type Input = Omit<Beneficiary, 'id' | 'searchTokens' | 'createdAt' | 'updatedAt'>

export async function createBeneficiary(input: Input): Promise<string> {
  const payload = stripUndefined({
    ...input,
    searchTokens: tokensFrom(
      input.fullName, input.nationalId, input.phone, input.phoneAlt,
      input.address?.city, input.address?.district, input.address?.neighborhood,
    ),
  })
  const docRef = await addDoc(ref(), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateBeneficiary(id: string, input: Partial<Input>): Promise<void> {
  const current = await getBeneficiary(id)
  if (!current) throw new Error('Muhtaç kaydı bulunamadı')
  const merged = { ...current, ...input }
  const clean = stripUndefined({
    ...input,
    searchTokens: tokensFrom(
      merged.fullName, merged.nationalId, merged.phone, merged.phoneAlt,
      merged.address?.city, merged.address?.district, merged.address?.neighborhood,
    ),
  })
  await updateDoc(doc(db, COL, id), { ...clean, updatedAt: serverTimestamp() })
}

export async function deleteBeneficiary(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
