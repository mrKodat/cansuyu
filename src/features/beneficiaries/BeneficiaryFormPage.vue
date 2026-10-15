<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, nextTick, type Directive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { getBeneficiary, createBeneficiary, updateBeneficiary, findByNationalId } from '@/services/beneficiaries'
import type { Beneficiary, FamilyMember, IncomeSource, GovernmentBenefit, ExternalAidRecord, HouseholdAppliance } from '@/types'
import { DefaultAppliances, DefaultCity, ElazigDistricts } from '@/types'
import { isValidTcKimlik, isPlaceholderTc, normalize } from '@/utils/search'
import { toUpperTr, checkPhone, formatPhone } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Checkbox from 'primevue/checkbox'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const auth = useAuthStore()

const id = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!id.value)

type Form = Omit<Beneficiary, 'id' | 'searchTokens' | 'createdAt' | 'updatedAt'>

const form = reactive<Form>({
  fullName: '', nationalId: '', birthDate: undefined, gender: undefined,
  phone: '', phoneAlt: '', email: '',
  address: { city: DefaultCity, district: '', neighborhood: '', fullAddress: '' },
  maritalStatus: undefined, familyMembers: [], dependentCount: 0,
  needLevel: 'medium', needNotes: '',
  housingStatus: undefined, monthlyRent: undefined, rentNote: '',
  householdAppliances: DefaultAppliances.map((name) => ({ name, status: 'have' as const })),
  incomes: [], governmentBenefits: [], externalAidRecords: [],
  tags: [], active: true, createdBy: auth.firebaseUser?.uid,
})

const birthDate = ref<Date | null>(null)
const saving = ref(false)
const checking = ref(false)

// ---- Adımlar ----
const steps = [
  { title: 'Kimlik & Adres', icon: 'pi pi-id-card' },
  { title: 'Durum & Konut', icon: 'pi pi-home' },
  { title: 'Aile & Gelir', icon: 'pi pi-users' },
]
const step = ref(0)
const isLastStep = computed(() => step.value === steps.length - 1)

// ---- Hatalar ----
// Alan anahtarı → kullanıcıya gösterilecek açıklama. Anahtar, şablondaki data-field ile eşleşir.
const errors = reactive<Record<string, string>>({})
// TC başka bir kayıtta kullanılıyorsa o kayda bağlantı vermek için
const duplicate = ref<{ id: string; fullName: string } | null>(null)
const errorCount = computed(() => Object.keys(errors).length)

function clearErrors() {
  for (const k of Object.keys(errors)) delete errors[k]
  duplicate.value = null
}

// Kullanıcı hatalı alanı düzelttiğinde hata mesajı hemen kaybolsun
watch(() => form.fullName, () => delete errors.fullName)
watch(() => form.nationalId, () => { delete errors.nationalId; duplicate.value = null })
watch(() => form.phone, () => delete errors.phone)
watch(() => form.phoneAlt, () => delete errors.phoneAlt)
watch(() => form.email, () => delete errors.email)
watch(() => form.familyMembers.map((m) => m.fullName), () => {
  for (const k of Object.keys(errors)) if (k.startsWith('family.')) delete errors[k]
}, { deep: true })

// ---- Seçenekler ----
const needLevels = [
  { label: 'Kritik', value: 'critical' }, { label: 'Yüksek', value: 'high' },
  { label: 'Orta', value: 'medium' }, { label: 'Düşük', value: 'low' },
]
const genderOptions = [
  { label: 'Erkek', value: 'male' }, { label: 'Kadın', value: 'female' }, { label: 'Diğer', value: 'other' },
]
const maritalOptions = [
  { label: 'Bekar', value: 'single' }, { label: 'Evli', value: 'married' },
  { label: 'Dul', value: 'widowed' }, { label: 'Boşanmış', value: 'divorced' },
]
const housingOptions = [
  { label: 'Ev sahibi', value: 'owner' },
  { label: 'Kiracı', value: 'tenant' },
  { label: 'Akraba/tanıdık yanında', value: 'relative' },
  { label: 'Diğer', value: 'other' },
]
const applianceStatusOptions = [
  { label: 'Mevcut', value: 'have' },
  { label: 'Yok', value: 'missing' },
  { label: 'Bozuk / Yetersiz', value: 'broken' },
]
const schoolLevelOptions = [
  { label: 'Okul öncesi', value: 'preschool' },
  { label: 'İlkokul', value: 'primary' },
  { label: 'Ortaokul', value: 'secondary' },
  { label: 'Lise', value: 'highschool' },
  { label: 'Üniversite', value: 'university' },
]

// Şehir Elazığ ise ilçe listeden seçilir; başka bir şehir yazılırsa serbest metin girilir.
const isDefaultCity = computed(() => normalize(form.address.city) === normalize(DefaultCity))
const districtOptions = computed(() => {
  const current = form.address.district
  // Eski kayıtlarda listede olmayan bir ilçe yazılmış olabilir; kaybolmasın diye seçeneklere ekle.
  if (current && !ElazigDistricts.includes(current)) return [...ElazigDistricts, current]
  return ElazigDistricts
})

// İsim alanlarını yazarken büyük harfe çevirir. Yakalama (capture) aşamasında çalıştığı için
// PrimeVue'nun kendi input dinleyicisinden önce değeri değiştirir; imleç yerinde kalır.
// IME (mobil klavye) bileşimi sırasında dokunmaz, bileşim bitince çevirir.
const vUppercase: Directive<HTMLInputElement> = {
  mounted(el) {
    const apply = () => {
      const upper = el.value.toLocaleUpperCase('tr-TR')
      if (upper === el.value) return false
      const { selectionStart, selectionEnd } = el
      el.value = upper
      el.setSelectionRange(selectionStart, selectionEnd)
      return true
    }
    el.addEventListener('input', (e) => { if (!(e as InputEvent).isComposing) apply() }, { capture: true })
    el.addEventListener('compositionend', () => {
      if (apply()) el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  },
}

onMounted(async () => {
  if (id.value) {
    const b = await getBeneficiary(id.value)
    if (b) {
      Object.assign(form, b)
      if (b.birthDate) birthDate.value = new Date(b.birthDate)
      if (b.phone) form.phone = formatPhone(b.phone)
      if (b.phoneAlt) form.phoneAlt = formatPhone(b.phoneAlt)
      // Eski kayıtlardaki "Palu" / "palu" gibi yazımları listedeki karşılığına eşle
      const match = ElazigDistricts.find((d) => normalize(d) === normalize(form.address.district))
      if (match) form.address.district = match
    }
  }
})

function addFamilyMember() {
  form.familyMembers.push({
    fullName: '', relation: '',
    isStudent: false, isDisabled: false, isWorking: false, hasInsurance: false,
  } as FamilyMember)
}
function removeFamilyMember(i: number) { form.familyMembers.splice(i, 1) }

function addAppliance() {
  form.householdAppliances.push({ name: '', status: 'have' } as HouseholdAppliance)
}
function removeAppliance(i: number) { form.householdAppliances.splice(i, 1) }
function addIncome() { form.incomes.push({ type: '', monthlyAmount: 0 } as IncomeSource) }
function removeIncome(i: number) { form.incomes.splice(i, 1) }
function addBenefit() { form.governmentBenefits.push({ program: '' } as GovernmentBenefit) }
function removeBenefit(i: number) { form.governmentBenefits.splice(i, 1) }
function addExternal() { form.externalAidRecords.push({ organization: '' } as ExternalAidRecord) }
function removeExternal(i: number) { form.externalAidRecords.splice(i, 1) }

// ---- Doğrulama ----
function tcError(tc: string): string | null {
  if (!tc) return 'TC Kimlik numarası boş bırakılamaz. Kimliği olmayan kişiler için 11111111111 yazabilirsiniz.'
  if (!/^\d+$/.test(tc)) return 'TC Kimlik numarası yalnızca rakamlardan oluşmalıdır (boşluk veya harf olmamalı).'
  if (tc.length !== 11) return `TC Kimlik numarası 11 haneli olmalıdır; şu an ${tc.length} hane girildi.`
  if (isPlaceholderTc(tc)) return null
  if (tc.startsWith('0')) return 'TC Kimlik numarası 0 ile başlayamaz.'
  if (!isValidTcKimlik(tc)) return 'Bu TC Kimlik numarası geçerli değil. Lütfen rakamları kimlikten tekrar kontrol edin.'
  return null
}

function phoneError(phone: string | undefined): string | null {
  const r = checkPhone(phone)
  return r.ok ? null : r.reason
}

// Alandan çıkınca: geçerliyse "0532 123 45 67" biçimine getir, değilse hemen uyar
function onPhoneBlur(field: 'phone' | 'phoneAlt') {
  const r = checkPhone(form[field])
  if (r.ok) form[field] = r.value ? formatPhone(r.value) : ''
  else errors[field] = r.reason
}

// Kaydederken yalnızca rakam ("05321234567") sakla — arama token'ları ve görüntüleme bununla çalışır
function phoneForSave(phone: string | undefined): string {
  const r = checkPhone(phone)
  return r.ok ? r.value : (phone ?? '')
}

async function validateStep(index: number): Promise<boolean> {
  clearErrors()

  if (index === 0) {
    const name = toUpperTr(form.fullName)
    if (!name) errors.fullName = 'Ad soyad boş bırakılamaz.'
    else if (name.split(' ').length < 2) errors.fullName = 'Lütfen hem adı hem soyadı yazın. Örnek: AHMET YILMAZ'

    form.nationalId = form.nationalId.trim()
    const tcMsg = tcError(form.nationalId)
    if (tcMsg) errors.nationalId = tcMsg

    const p1 = phoneError(form.phone)
    if (p1) errors.phone = p1
    const p2 = phoneError(form.phoneAlt)
    if (p2) errors.phoneAlt = p2
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'E-posta adresi hatalı görünüyor. Örnek: ad@ornek.com'
    }

    // Biçim doğruysa aynı TC ile başka kayıt var mı bak (yer tutucu TC'ler muaf)
    if (!errors.nationalId && !isPlaceholderTc(form.nationalId)) {
      checking.value = true
      try {
        const existing = await findByNationalId(form.nationalId)
        if (existing && existing.id !== id.value) {
          errors.nationalId = `Bu TC Kimlik numarası ile zaten bir kayıt var: ${existing.fullName}`
          duplicate.value = { id: existing.id, fullName: existing.fullName }
        }
      } catch {
        errors.nationalId = 'TC Kimlik numarası kontrol edilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'
      } finally {
        checking.value = false
      }
    }
  }

  if (index === 2) {
    form.familyMembers.forEach((m, i) => {
      if (!m.fullName?.trim()) errors[`family.${i}`] = `${i + 1}. aile bireyinin adı boş. Adını yazın ya da bu satırı silin.`
    })
  }

  if (errorCount.value) {
    await focusFirstError()
    return false
  }
  return true
}

async function focusFirstError() {
  await nextTick()
  const el = document.querySelector<HTMLElement>('.field--error, .member--error')
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true })
}

async function next() {
  if (!(await validateStep(step.value))) return
  step.value++
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function back() {
  clearErrors()
  step.value--
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Başlıktaki adımlara tıklayarak geri dönülebilir; ileri gitmek için aradaki adımlar doğrulanır.
async function goTo(target: number) {
  if (target === step.value) return
  if (target < step.value) { clearErrors(); step.value = target; return }
  while (step.value < target) {
    if (!(await validateStep(step.value))) return
    step.value++
  }
}

async function onSubmit() {
  if (isLastStep.value) await save()
  else await next()
}

function friendlySaveError(e: unknown): string {
  const code = (e as { code?: string }).code
  if (code === 'permission-denied') return 'Bu işlemi yapmak için yetkiniz yok. Yöneticinizle iletişime geçin.'
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
  }
  return `Kayıt sırasında bir sorun oluştu: ${(e as Error).message}`
}

async function save() {
  // Kaydetmeden önce tüm adımları doğrula; hata varsa ilgili adıma dön
  for (let i = 0; i < steps.length; i++) {
    if (!(await validateStep(i))) { step.value = i; await focusFirstError(); return }
  }

  form.fullName = toUpperTr(form.fullName)
  form.address.city = toUpperTr(form.address.city)
  form.familyMembers.forEach((m) => { m.fullName = toUpperTr(m.fullName) })

  saving.value = true
  try {
    if (birthDate.value) form.birthDate = birthDate.value.toISOString().slice(0, 10)
    const payload = { ...form, phone: phoneForSave(form.phone), phoneAlt: phoneForSave(form.phoneAlt) }
    if (isEdit.value && id.value) {
      await updateBeneficiary(id.value, payload)
      toast.add({ severity: 'success', summary: 'Güncellendi', detail: 'Muhtaç kaydı güncellendi.', life: 3000 })
      router.push({ name: 'beneficiary-detail', params: { id: id.value } })
    } else {
      const newId = await createBeneficiary(payload)
      toast.add({ severity: 'success', summary: 'Kaydedildi', detail: 'Yeni muhtaç kaydı oluşturuldu.', life: 3000 })
      router.push({ name: 'beneficiary-detail', params: { id: newId } })
    }
  } catch (e) {
    errors.save = friendlySaveError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">{{ isEdit ? 'Muhtaç Düzenle' : 'Yeni Muhtaç Kaydı' }}</h2>
        <p class="page__subtitle">Zorunlu alanlar * ile işaretlidir. Diğer bilgileri daha sonra da ekleyebilirsiniz.</p>
      </div>
      <Button label="İptal" severity="secondary" text @click="router.back()" />
    </div>

    <ol class="steps">
      <li
        v-for="(s, i) in steps" :key="s.title"
        class="steps__item"
        :class="{ 'steps__item--active': i === step, 'steps__item--done': i < step }"
      >
        <button type="button" class="steps__button" :aria-current="i === step ? 'step' : undefined" @click="goTo(i)">
          <span class="steps__circle">
            <i v-if="i < step" class="pi pi-check" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="steps__label">{{ s.title }}</span>
        </button>
      </li>
    </ol>

    <Message v-if="errors.save" severity="error" :closable="false">{{ errors.save }}</Message>
    <Message v-else-if="errorCount" severity="warn" :closable="false">
      <strong>{{ isLastStep ? 'Kaydetmeden' : 'Devam etmeden' }} önce {{ errorCount }} alanı kontrol edin.</strong>
      Sorunlu alanlar aşağıda kırmızı ile işaretlendi.
    </Message>

    <form class="card" novalidate @submit.prevent="onSubmit">
      <!-- 1. ADIM: Kimlik & Adres -->
      <div v-show="step === 0">
        <h3 class="section">Kişisel Bilgiler</h3>
        <div class="grid">
          <div class="field" :class="{ 'field--error': errors.fullName }">
            <label for="fullName">Ad Soyad *</label>
            <InputText id="fullName" v-model="form.fullName" v-uppercase class="upper" :invalid="!!errors.fullName" placeholder="AHMET YILMAZ" autocomplete="off" fluid />
            <small v-if="errors.fullName" class="field__error"><i class="pi pi-exclamation-circle" /> {{ errors.fullName }}</small>
          </div>
          <div class="field" :class="{ 'field--error': errors.nationalId }">
            <label for="nationalId">TC Kimlik *</label>
            <InputText id="nationalId" v-model="form.nationalId" maxlength="11" inputmode="numeric" :invalid="!!errors.nationalId" placeholder="11 haneli" autocomplete="off" fluid />
            <small v-if="errors.nationalId" class="field__error">
              <i class="pi pi-exclamation-circle" /> {{ errors.nationalId }}
              <router-link v-if="duplicate" :to="{ name: 'beneficiary-detail', params: { id: duplicate.id } }" class="field__link">Kaydı aç →</router-link>
            </small>
            <small v-else class="field__hint">Kimliği olmayanlar için 11111111111 yazılabilir.</small>
          </div>
          <div class="field"><label>Doğum Tarihi</label><DatePicker v-model="birthDate" date-format="dd.mm.yy" show-icon fluid /></div>
          <div class="field"><label>Cinsiyet</label><Select v-model="form.gender" :options="genderOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid /></div>
          <div class="field"><label>Medeni Durum</label><Select v-model="form.maritalStatus" :options="maritalOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid /></div>
          <div class="field" :class="{ 'field--error': errors.phone }">
            <label for="phone">Telefon</label>
            <InputText id="phone" v-model="form.phone" inputmode="tel" :invalid="!!errors.phone" placeholder="0532 123 45 67" fluid @blur="onPhoneBlur('phone')" />
            <small v-if="errors.phone" class="field__error"><i class="pi pi-exclamation-circle" /> {{ errors.phone }}</small>
          </div>
          <div class="field" :class="{ 'field--error': errors.phoneAlt }">
            <label for="phoneAlt">Alternatif Telefon</label>
            <InputText id="phoneAlt" v-model="form.phoneAlt" inputmode="tel" :invalid="!!errors.phoneAlt" placeholder="0532 123 45 67" fluid @blur="onPhoneBlur('phoneAlt')" />
            <small v-if="errors.phoneAlt" class="field__error"><i class="pi pi-exclamation-circle" /> {{ errors.phoneAlt }}</small>
          </div>
          <div class="field" :class="{ 'field--error': errors.email }">
            <label for="email">E-posta</label>
            <InputText id="email" v-model="form.email" inputmode="email" :invalid="!!errors.email" fluid />
            <small v-if="errors.email" class="field__error"><i class="pi pi-exclamation-circle" /> {{ errors.email }}</small>
          </div>
        </div>

        <h3 class="section">Adres</h3>
        <div class="grid">
          <div class="field"><label for="city">Şehir</label><InputText id="city" v-model="form.address.city" v-uppercase class="upper" fluid /></div>
          <div class="field"><label>İlçe</label>
            <Select
              v-if="isDefaultCity" v-model="form.address.district" :options="districtOptions"
              placeholder="İlçe seçiniz" show-clear fluid
            />
            <InputText v-else v-model="form.address.district" fluid />
          </div>
          <div class="field"><label>Mahalle</label><InputText v-model="form.address.neighborhood" fluid /></div>
          <div class="field field--full"><label>Açık Adres</label><Textarea v-model="form.address.fullAddress" rows="2" fluid /></div>
        </div>
      </div>

      <!-- 2. ADIM: Durum & Konut -->
      <div v-show="step === 1">
        <h3 class="section">Muhtaçlık Değerlendirmesi</h3>
        <div class="grid">
          <div class="field"><label>Muhtaçlık Seviyesi *</label><Select v-model="form.needLevel" :options="needLevels" option-label="label" option-value="value" fluid /></div>
          <div class="field"><label>Bakmakla Yükümlü Kişi Sayısı</label><InputNumber v-model="form.dependentCount" :min="0" fluid /></div>
          <div class="field field--full"><label>Durum Notları</label><Textarea v-model="form.needNotes" rows="3" fluid /></div>
        </div>

        <h3 class="section">Konut Durumu</h3>
        <div class="grid">
          <div class="field"><label>Konut Durumu</label>
            <Select v-model="form.housingStatus" :options="housingOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid />
          </div>
          <div class="field"><label>Aylık Ev Kirası</label>
            <InputNumber v-model="form.monthlyRent" mode="currency" currency="TRY" locale="tr-TR" :min="0" fluid />
          </div>
          <div class="field field--full"><label>Kira / Konut Notu</label>
            <InputText v-model="form.rentNote" placeholder="Ör. kira yardımı alıyor, ev sahibi akraba…" fluid />
          </div>
        </div>

        <h3 class="section">Evdeki Eşya Durumu
          <Button type="button" icon="pi pi-plus" label="Ekle" size="small" text @click="addAppliance" />
        </h3>
        <div class="appliances">
          <div v-for="(ap, i) in form.householdAppliances" :key="i" class="appliance">
            <InputText v-model="ap.name" placeholder="Eşya adı" fluid />
            <Select v-model="ap.status" :options="applianceStatusOptions" option-label="label" option-value="value" fluid />
            <InputText v-model="ap.note" placeholder="Not (opsiyonel)" fluid />
            <Button type="button" icon="pi pi-trash" severity="danger" text @click="removeAppliance(i)" />
          </div>
        </div>
      </div>

      <!-- 3. ADIM: Aile & Gelir -->
      <div v-show="step === 2">
        <h3 class="section">Aile Bireyleri
          <Button type="button" icon="pi pi-plus" label="Ekle" size="small" text @click="addFamilyMember" />
        </h3>
        <p v-if="!form.familyMembers.length" class="muted">Henüz aile bireyi eklenmedi.</p>
        <div v-for="(fm, i) in form.familyMembers" :key="i" class="member" :class="{ 'member--error': errors[`family.${i}`] }">
          <div class="member__head">
            <span class="member__index">#{{ i + 1 }}</span>
            <Button type="button" icon="pi pi-trash" severity="danger" text rounded @click="removeFamilyMember(i)" />
          </div>
          <div class="grid">
            <div class="field" :class="{ 'field--error': errors[`family.${i}`] }">
              <label>Ad Soyad *</label>
              <InputText v-model="fm.fullName" v-uppercase class="upper" :invalid="!!errors[`family.${i}`]" fluid />
              <small v-if="errors[`family.${i}`]" class="field__error"><i class="pi pi-exclamation-circle" /> {{ errors[`family.${i}`] }}</small>
            </div>
            <div class="field"><label>Yakınlık</label><InputText v-model="fm.relation" placeholder="eş, çocuk, anne…" fluid /></div>
            <div class="field"><label>Yaş</label><InputNumber v-model="fm.age" :min="0" :max="120" fluid /></div>
            <div class="field"><label>Cinsiyet</label>
              <Select v-model="fm.gender" :options="genderOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid />
            </div>
            <div class="field"><label>Beden</label><InputText v-model="fm.clothingSize" placeholder="S / M / 40 / 42…" fluid /></div>
            <div class="field"><label>Ayakkabı No</label><InputText v-model="fm.shoeSize" fluid /></div>
          </div>

          <div class="checks">
            <div class="check"><Checkbox v-model="fm.isStudent" binary /><span>Öğrenci</span></div>
            <div class="check"><Checkbox v-model="fm.isDisabled" binary /><span>Engelli</span></div>
            <div class="check"><Checkbox v-model="fm.isWorking" binary /><span>Çalışıyor</span></div>
            <div class="check"><Checkbox v-model="fm.hasInsurance" binary /><span>Sigortalı (SGK)</span></div>
          </div>

          <div class="grid">
            <div v-if="fm.isStudent" class="field"><label>Eğitim Seviyesi</label>
              <Select v-model="fm.schoolLevel" :options="schoolLevelOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid />
            </div>
            <div v-if="fm.isWorking" class="field"><label>Meslek</label><InputText v-model="fm.occupation" fluid /></div>
            <div v-if="fm.isDisabled" class="field field--full"><label>Engellilik Açıklaması</label>
              <InputText v-model="fm.disabilityNote" placeholder="Tür, oran, açıklama…" fluid />
            </div>
            <div class="field field--full"><label>Kronik Hastalık</label>
              <InputText v-model="fm.chronicIllness" placeholder="Varsa belirtin" fluid />
            </div>
            <div class="field field--full"><label>Not</label><InputText v-model="fm.note" fluid /></div>
          </div>
        </div>

        <h3 class="section">Gelirler
          <Button type="button" icon="pi pi-plus" label="Ekle" size="small" text @click="addIncome" />
        </h3>
        <div v-for="(inc, i) in form.incomes" :key="i" class="grid grid--row">
          <InputText v-model="inc.type" placeholder="Gelir türü (maaş, kira…)" fluid />
          <InputNumber v-model="inc.monthlyAmount" mode="currency" currency="TRY" locale="tr-TR" fluid />
          <InputText v-model="inc.note" placeholder="Not" fluid />
          <Button type="button" icon="pi pi-trash" severity="danger" text @click="removeIncome(i)" />
        </div>

        <h3 class="section">Devlet Destekleri
          <Button type="button" icon="pi pi-plus" label="Ekle" size="small" text @click="addBenefit" />
        </h3>
        <div v-for="(b, i) in form.governmentBenefits" :key="i" class="grid grid--row">
          <InputText v-model="b.program" placeholder="Program (SYDV, 2022 Sayılı…)" fluid />
          <InputNumber v-model="b.monthlyAmount" mode="currency" currency="TRY" locale="tr-TR" fluid />
          <InputText v-model="b.since" placeholder="Başlangıç" fluid />
          <Button type="button" icon="pi pi-trash" severity="danger" text @click="removeBenefit(i)" />
        </div>

        <h3 class="section">Diğer Kuruluş Kayıtları
          <Button type="button" icon="pi pi-plus" label="Ekle" size="small" text @click="addExternal" />
        </h3>
        <div v-for="(e, i) in form.externalAidRecords" :key="i" class="grid grid--row">
          <InputText v-model="e.organization" placeholder="Kuruluş adı" fluid />
          <InputText v-model="e.type" placeholder="Yardım türü" fluid />
          <InputText v-model="e.note" placeholder="Not" fluid />
          <Button type="button" icon="pi pi-trash" severity="danger" text @click="removeExternal(i)" />
        </div>
      </div>

      <div class="actions">
        <Button v-if="step > 0" type="button" label="Geri" icon="pi pi-arrow-left" severity="secondary" outlined @click="back" />
        <span class="actions__spacer" />
        <span class="actions__progress">Adım {{ step + 1 }} / {{ steps.length }}</span>
        <!-- Düzenlemede küçük bir değişiklik için tüm adımları gezmek gerekmesin -->
        <Button
          v-if="isEdit && !isLastStep" type="button" label="Güncelle" icon="pi pi-check"
          severity="secondary" outlined :loading="saving" @click="save"
        />
        <Button
          v-if="!isLastStep" type="submit" label="İleri" icon="pi pi-arrow-right" icon-pos="right"
          :loading="checking"
        />
        <Button v-else type="submit" :label="isEdit ? 'Güncelle' : 'Kaydet'" icon="pi pi-check" :loading="saving" />
      </div>
    </form>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: flex-end; }
.page__title { font-size: $font-size-2xl; font-weight: 700; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
.card { background: $white; border-radius: $radius-lg; padding: $spacing-xl; box-shadow: $shadow-sm; border: 1px solid $gray-200; }
.section { display: flex; align-items: center; gap: $spacing-sm; font-size: $font-size-lg; font-weight: 600; color: $gray-900;
  margin: $spacing-xl 0 $spacing-md; padding-bottom: $spacing-sm; border-bottom: 1px solid $gray-100;
  &:first-child { margin-top: 0; }
}
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: $spacing-md; }
.grid--row { grid-template-columns: 2fr 1.5fr 1fr 1.5fr auto; align-items: end; margin-bottom: $spacing-sm; }
.field { display: flex; flex-direction: column; gap: $spacing-xs;
  label { font-size: $font-size-sm; font-weight: 500; color: $gray-700; }
  &--full { grid-column: 1 / -1; }
  &--error label { color: #dc2626; }
  // Odaklıyken de kırmızı kalsın (Aura odakta ana rengi kullanır)
  &--error .p-inputtext.p-invalid { border-color: #dc2626; }
}
.field__error { color: #dc2626; font-size: $font-size-sm; line-height: 1.4;
  i { font-size: 0.85em; margin-right: 2px; }
}
.field__hint { color: $gray-500; font-size: $font-size-sm; }
.field__link { margin-left: $spacing-xs; font-weight: 600; color: inherit; text-decoration: underline; }
// Yazarken anında büyük harf görünsün (asıl dönüşüm JS ile yapılır; html lang="tr" sayesinde i → İ)
.upper { text-transform: uppercase; }
.muted { color: $gray-500; font-style: italic; margin: 0 0 $spacing-md; }

// Adım göstergesi
.steps { list-style: none; margin: 0; padding: 0; display: flex; gap: $spacing-sm; }
.steps__item { flex: 1; position: relative;
  &:not(:last-child)::after {
    content: ''; position: absolute; top: 18px; left: calc(50% + 24px); right: calc(-50% + 24px);
    height: 2px; background: $gray-200;
  }
  &--done:not(:last-child)::after { background: #22c55e; }
}
.steps__button { width: 100%; display: flex; flex-direction: column; align-items: center; gap: $spacing-xs;
  background: none; border: none; cursor: pointer; padding: 0; font: inherit; color: $gray-500;
}
.steps__circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 700; background: $white; border: 2px solid $gray-300; color: $gray-500; position: relative; z-index: 1;
}
.steps__label { font-size: $font-size-sm; font-weight: 500; text-align: center; }
.steps__item--active {
  .steps__circle { border-color: var(--p-primary-color); background: var(--p-primary-color); color: $white; }
  .steps__label { color: $gray-900; font-weight: 600; }
}
.steps__item--done {
  .steps__circle { border-color: #22c55e; background: #22c55e; color: $white; }
  .steps__label { color: $gray-700; }
}

.member {
  padding: $spacing-md; margin-bottom: $spacing-md;
  background: $gray-50; border: 1px solid $gray-200; border-radius: $radius-md;
  display: flex; flex-direction: column; gap: $spacing-md;
  &--error { border-color: #fca5a5; }
}
.member__head { display: flex; justify-content: space-between; align-items: center; }
.member__index { font-weight: 600; color: $gray-600; }
.checks { display: flex; flex-wrap: wrap; gap: $spacing-lg;
  .check { display: flex; align-items: center; gap: $spacing-sm; color: $gray-700; font-size: $font-size-sm; cursor: pointer; }
}

.appliances { display: flex; flex-direction: column; gap: $spacing-sm; }
.appliance { display: grid; grid-template-columns: 2fr 1.2fr 2fr auto; gap: $spacing-sm; align-items: center; }

.actions { display: flex; align-items: center; gap: $spacing-md; margin-top: $spacing-xl; padding-top: $spacing-lg; border-top: 1px solid $gray-100; }
.actions__spacer { flex: 1; }
.actions__progress { color: $gray-500; font-size: $font-size-sm; }

@media (max-width: $breakpoint-md) {
  .card { padding: $spacing-md; }
  .page__header { flex-wrap: wrap; gap: $spacing-md; }
  .grid { grid-template-columns: 1fr; }
  .grid--row,
  .appliance { grid-template-columns: 1fr; }
  .steps__label { font-size: 0.75rem; }
  .actions { flex-wrap: wrap; }
  .actions__progress { display: none; }
}
</style>
