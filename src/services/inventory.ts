import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp, runTransaction,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { InventoryItem, InventoryMovement, InventoryMovementType } from '@/types'
import { stripUndefined } from '@/utils/search'

const ITEMS = 'inventory'
const MOVES = 'inventoryMovements'

export async function listInventory(): Promise<InventoryItem[]> {
  const snap = await getDocs(query(collection(db, ITEMS), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) }))
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const snap = await getDoc(doc(db, ITEMS, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<InventoryItem, 'id'>) }
}

type ItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>

export async function createInventoryItem(input: ItemInput): Promise<string> {
  const docRef = await addDoc(collection(db, ITEMS), {
    ...stripUndefined(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateInventoryItem(id: string, input: Partial<ItemInput>): Promise<void> {
  await updateDoc(doc(db, ITEMS, id), { ...stripUndefined(input), updatedAt: serverTimestamp() })
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await deleteDoc(doc(db, ITEMS, id))
}

export async function recordMovement(
  itemId: string, type: InventoryMovementType, quantity: number,
  extra: Partial<InventoryMovement> = {},
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const itemRef = doc(db, ITEMS, itemId)
    const snap = await tx.get(itemRef)
    if (!snap.exists()) throw new Error('Envanter kalemi bulunamadı')
    const current = snap.data() as InventoryItem
    const delta = type === 'in' ? quantity : type === 'out' ? -quantity : quantity - current.quantity
    const next = Math.max(0, current.quantity + delta)
    tx.update(itemRef, { quantity: next, updatedAt: serverTimestamp() })
    const moveRef = doc(collection(db, MOVES))
    tx.set(moveRef, stripUndefined({
      itemId, itemName: current.name, type, quantity,
      ...extra, createdAt: serverTimestamp(),
    }))
  })
}

export async function listMovements(itemId?: string, max = 100): Promise<InventoryMovement[]> {
  const base = collection(db, MOVES)
  const q = itemId
    ? query(base, where('itemId', '==', itemId), orderBy('createdAt', 'desc'), limit(max))
    : query(base, orderBy('createdAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryMovement, 'id'>) }))
}
