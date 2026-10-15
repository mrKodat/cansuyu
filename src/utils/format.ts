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

// Türkçe büyük harf: "i" → "İ", "ı" → "I". Fazla boşlukları da temizler.
export function toUpperTr(value: string | null | undefined): string {
  if (!value) return ''
  return value.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim()
}

export type PhoneCheck = { ok: true; value: string } | { ok: false; reason: string }

// Telefonu esnek biçimde yorumlar: "0532 532 90 53", "532 532 9053", "+90 532 532 90 53",
// "(0532) 532-90-53", "0090532…" hepsi kabul edilir. Geçerliyse value = "05325329053"
// (yalnızca rakam, başta 0). "+" ile başlayan yabancı numaralar olduğu gibi kabul edilir.
export function checkPhone(raw: string | null | undefined): PhoneCheck {
  const input = (raw ?? '').trim()
  if (!input) return { ok: true, value: '' }
  if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(input)) {
    return { ok: false, reason: 'Telefon numarasında harf olmamalı. Örnek: 0532 123 45 67' }
  }

  let d = input.replace(/\D/g, '')
  const international = input.startsWith('+') || d.startsWith('00')
  if (d.startsWith('00')) d = d.slice(2)
  if (international && !d.startsWith('90')) {
    if (d.length >= 8 && d.length <= 15) return { ok: true, value: `+${d}` }
    return { ok: false, reason: 'Yurt dışı numarası eksik veya hatalı görünüyor.' }
  }
  if (d.startsWith('90') && d.length >= 12) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)

  if (d.length < 10) {
    return {
      ok: false,
      reason: `Telefon numarasında ${10 - d.length} rakam eksik. Alan koduyla birlikte yazın, örnek: 0532 123 45 67`,
    }
  }
  if (d.length > 10) {
    return {
      ok: false,
      reason: `Telefon numarasında ${d.length - 10} rakam fazla. Örnek: 0532 123 45 67`,
    }
  }
  return { ok: true, value: `0${d}` }
}
