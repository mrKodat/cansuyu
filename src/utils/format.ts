import type { Timestamp } from 'firebase/firestore'

export function toDate(value: Timestamp | Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') return new Date(value)
  if (typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate()
  return null
}

export function formatDate(value: Timestamp | Date | string | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(value: Timestamp | Date | string | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleString('tr-TR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: 'TRY', maximumFractionDigits: 2,
})

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return currencyFormatter.format(amount)
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('0')) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`
  }
  if (d.length === 10) {
    return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`
  }
  return value
}
