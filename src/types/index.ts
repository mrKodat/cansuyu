import type { Timestamp } from 'firebase/firestore'

export type ISODate = string
export type FirestoreDate = Timestamp | Date | null

// ─── Roller ────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'manager' | 'representative' | 'viewer'

export const RoleLabels: Record<Role, string> = {
  admin: 'Sistem Yöneticisi',
  manager: 'Şube Sorumlusu',
  representative: 'Temsilci',
  viewer: 'Gözlemci',
}

// Modül → Eylem yetkileri. Permission checker tarafından kullanılır.
export type Module =
  | 'beneficiaries'
  | 'donors'
  | 'aids'
  | 'inventory'
  | 'representatives'
  | 'applications'
  | 'reports'

export type Action = 'view' | 'create' | 'update' | 'delete'

export const RolePermissions: Record<Role, Partial<Record<Module, Action[]>>> = {
  admin: {
    beneficiaries: ['view', 'create', 'update', 'delete'],
    donors: ['view', 'create', 'update', 'delete'],
    aids: ['view', 'create', 'update', 'delete'],
    inventory: ['view', 'create', 'update', 'delete'],
    representatives: ['view', 'create', 'update', 'delete'],
    applications: ['view', 'create', 'update', 'delete'],
    reports: ['view'],
  },
  manager: {
    beneficiaries: ['view', 'create', 'update'],
    donors: ['view', 'create', 'update'],
    aids: ['view', 'create', 'update', 'delete'],
    inventory: ['view', 'create', 'update'],
    representatives: ['view'],
    applications: ['view', 'update'],
    reports: ['view'],
  },
  representative: {
    beneficiaries: ['view', 'create', 'update'],
    donors: ['view', 'create'],
    aids: ['view', 'create'],
    inventory: ['view'],
    applications: ['view'],
  },
  viewer: {
    beneficiaries: ['view'],
    donors: ['view'],
    aids: ['view'],
    inventory: ['view'],
    applications: ['view'],
    reports: ['view'],
  },
}

// ─── Temsilci (users) ──────────────────────────────────────────────────────
export interface Representative {
  id: string
  uid: string // Firebase Auth UID
  email: string
  fullName: string
  phone?: string
  role: Role
  branch?: string
  active: boolean
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
  lastLoginAt?: FirestoreDate
}

// ─── Muhtaç (beneficiaries) ────────────────────────────────────────────────
export type NeedLevel = 'critical' | 'high' | 'medium' | 'low'
export type MaritalStatus = 'single' | 'married' | 'widowed' | 'divorced'

export const NeedLevelLabels: Record<NeedLevel, string> = {
  critical: 'Kritik',
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
}

export interface FamilyMember {
  fullName: string
  relation: string // eş, çocuk, anne, baba, kardeş
  birthYear?: number
  age?: number
  gender?: 'male' | 'female' | 'other'
  clothingSize?: string // beden (XS/S/M/L/XL veya 40, 42 vb.)
  shoeSize?: string
  isStudent?: boolean
  schoolLevel?: string // ilkokul, ortaokul, lise, üniversite
  isDisabled?: boolean
  disabilityNote?: string
  isWorking?: boolean
  occupation?: string
  hasInsurance?: boolean // SGK / sigortalı mı
  chronicIllness?: string
  note?: string
}

export type AppliancePresence = 'have' | 'missing' | 'broken'

export const AppliancePresenceLabels: Record<AppliancePresence, string> = {
  have: 'Mevcut',
  missing: 'Yok',
  broken: 'Bozuk / Yetersiz',
}

export interface HouseholdAppliance {
  name: string // Buzdolabı, Çamaşır Makinesi, Bulaşık Makinesi, Fırın, Ocak, Televizyon, Isıtıcı, Yatak vb.
  status: AppliancePresence
  note?: string
}

export const DefaultAppliances: string[] = [
  'Buzdolabı',
  'Çamaşır Makinesi',
  'Bulaşık Makinesi',
  'Fırın / Ocak',
  'Televizyon',
  'Isıtıcı / Soba',
  'Yatak',
  'Yemek Masası',
  'Gardırop',
]

export interface IncomeSource {
  type: string // maaş, emekli, kira, yardım vb.
  monthlyAmount: number
  note?: string
}

export interface GovernmentBenefit {
  program: string // SYDV, 2022 Sayılı Aylık, Engelli Aylığı, vb.
  monthlyAmount?: number
  since?: string
  note?: string
}

export interface ExternalAidRecord {
  organization: string
  type?: string
  note?: string
}

export interface Beneficiary {
  id: string
  fullName: string
  nationalId: string // TC Kimlik No
  birthDate?: ISODate
  gender?: 'male' | 'female' | 'other'
  phone?: string
  phoneAlt?: string
  email?: string

  address: {
    city?: string
    district?: string
    neighborhood?: string
    fullAddress?: string
  }

  maritalStatus?: MaritalStatus
  familyMembers: FamilyMember[]
  dependentCount: number

  needLevel: NeedLevel
  needNotes?: string

  // Konut / kira
  housingStatus?: 'owner' | 'tenant' | 'relative' | 'other'
  monthlyRent?: number
  rentNote?: string
  householdAppliances: HouseholdAppliance[]

  incomes: IncomeSource[]
  governmentBenefits: GovernmentBenefit[]
  externalAidRecords: ExternalAidRecord[]

  documents?: {
    label: string
    url: string
    uploadedAt?: FirestoreDate
  }[]

  // Arama için normalleştirilmiş alan (lowercase, diacritic-free)
  searchTokens: string[]

  tags?: string[]
  active: boolean
  createdBy?: string // representative uid
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
}

// ─── Bağışçı (donors) ──────────────────────────────────────────────────────
export type DonorType = 'individual' | 'corporate'

export interface Donor {
  id: string
  type: DonorType
  fullName: string // bireyde ad-soyad, kurumda unvan
  nationalId?: string
  taxNumber?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  note?: string
  searchTokens: string[]
  totalDonated?: number
  donationCount?: number
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
}

// ─── Yardım (aids) ─────────────────────────────────────────────────────────
export type AidType = 'cash' | 'food' | 'clothing' | 'fuel' | 'medical' | 'education' | 'other'
export type AidStatus = 'pending' | 'approved' | 'delivered' | 'cancelled'

export const AidTypeLabels: Record<AidType, string> = {
  cash: 'Nakdi',
  food: 'Gıda',
  clothing: 'Giyim',
  fuel: 'Yakacak',
  medical: 'Sağlık',
  education: 'Eğitim',
  other: 'Diğer',
}

export const AidStatusLabels: Record<AidStatus, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
}

export interface AidItem {
  inventoryId?: string
  name: string
  quantity: number
  unit: string
  unitCost?: number
}

export interface Aid {
  id: string
  beneficiaryId: string
  beneficiaryName: string // denormalized for list views
  type: AidType
  status: AidStatus
  amount?: number // cash için
  currency?: string
  items?: AidItem[] // ayni yardım kalemleri
  donorId?: string
  donorName?: string
  deliveredAt?: FirestoreDate
  deliveredBy?: string // representative uid
  deliveredByName?: string
  note?: string
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
}

// ─── Envanter (inventory) ──────────────────────────────────────────────────
export type InventoryCategory = 'food' | 'clothing' | 'hygiene' | 'fuel' | 'medical' | 'other'

export const InventoryCategoryLabels: Record<InventoryCategory, string> = {
  food: 'Gıda',
  clothing: 'Giyim',
  hygiene: 'Hijyen',
  fuel: 'Yakacak',
  medical: 'Sağlık',
  other: 'Diğer',
}

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  unit: string // adet, kg, lt, paket
  quantity: number
  lowStockThreshold?: number
  location?: string
  note?: string
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
}

export type InventoryMovementType = 'in' | 'out' | 'adjustment'

export interface InventoryMovement {
  id: string
  itemId: string
  itemName: string
  type: InventoryMovementType
  quantity: number
  reason?: string
  aidId?: string
  donorId?: string
  performedBy?: string
  createdAt?: FirestoreDate
}

// ─── Başvuru (applications) — web formu için hazır iskelet ─────────────────
export type ApplicationStatus = 'new' | 'in_review' | 'approved' | 'rejected' | 'converted'

export const ApplicationStatusLabels: Record<ApplicationStatus, string> = {
  new: 'Yeni',
  in_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  converted: 'Muhtaç Kaydına Dönüştü',
}

export interface Application {
  id: string
  fullName: string
  nationalId?: string
  phone: string
  email?: string
  city?: string
  district?: string
  address?: string
  dependentCount?: number
  monthlyIncome?: number
  reason: string
  status: ApplicationStatus
  reviewedBy?: string
  reviewedAt?: FirestoreDate
  convertedBeneficiaryId?: string
  note?: string
  source: 'web' | 'phone' | 'in_person'
  createdAt?: FirestoreDate
  updatedAt?: FirestoreDate
}
