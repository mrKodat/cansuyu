// Türkçe karakterleri ASCII'ye indirgeyip arama token'ı üretir.
const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

export function normalize(value: string | undefined | null): string {
  if (!value) return ''
  return value
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s@.+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokensFrom(...values: (string | undefined | null)[]): string[] {
  const joined = values.map((v) => normalize(v)).join(' ')
  const set = new Set<string>()
  for (const word of joined.split(' ')) {
    if (word.length < 2) continue
    set.add(word)
    // prefix indeksleri (isim/TC/telefon içinde prefix araması için)
    for (let i = 2; i < Math.min(word.length, 8); i++) {
      set.add(word.slice(0, i))
    }
  }
  return [...set].slice(0, 50)
}

// Firestore undefined değer kabul etmez — nesne ve iç içe nesnelerden temizler.
// Date, Timestamp gibi özel sınıfları olduğu gibi bırakır (aksi halde plain object'e dönüşüp bozulurlar).
export function stripUndefined<T>(value: T): T {
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    // Sadece plain object'leri rekürsif temizle; sınıf örneklerini (Timestamp, GeoPoint vb.) olduğu gibi geri ver.
    if (proto !== Object.prototype && proto !== null) return value
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}

// Gerçek TC'si olmayan kişiler için kullanılan yer tutucu (örn. 11111111111).
// Aynı rakamın 11 kez tekrarı yer tutucu sayılır; algoritmik doğrulama ve benzersizlik
// kontrolünden muaftır, böylece birden fazla kayıtta tekrarlanabilir.
export function isPlaceholderTc(tc: string): boolean {
  return /^(\d)\1{10}$/.test(tc)
}

// TC Kimlik No algoritmik doğrulama
export function isValidTcKimlik(tc: string): boolean {
  if (!/^\d{11}$/.test(tc)) return false
  const digits = tc.split('').map((d) => parseInt(d, 10))
  if (digits[0] === 0) return false
  const odd = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!
  const even = digits[1]! + digits[3]! + digits[5]! + digits[7]!
  const d10 = (odd * 7 - even) % 10
  if (d10 !== digits[9]) return false
  const sumFirst10 = digits.slice(0, 10).reduce((a, b) => a + b, 0)
  return sumFirst10 % 10 === digits[10]
}
