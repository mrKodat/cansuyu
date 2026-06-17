<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { getBeneficiary, createBeneficiary, updateBeneficiary, findByNationalId } from '@/services/beneficiaries'
import type { Beneficiary, FamilyMember, IncomeSource, GovernmentBenefit, ExternalAidRecord, HouseholdAppliance } from '@/types'
import { DefaultAppliances } from '@/types'
import { isValidTcKimlik, isPlaceholderTc } from '@/utils/search'
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
  address: { city: '', district: '', neighborhood: '', fullAddress: '' },
  maritalStatus: undefined, familyMembers: [], dependentCount: 0,
  needLevel: 'medium', needNotes: '',
  housingStatus: undefined, monthlyRent: undefined, rentNote: '',
  householdAppliances: DefaultAppliances.map((name) => ({ name, status: 'have' as const })),
  incomes: [], governmentBenefits: [], externalAidRecords: [],
  tags: [], active: true, createdBy: auth.firebaseUser?.uid,
})

const birthDate = ref<Date | null>(null)
const error = ref('')
const saving = ref(false)

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

onMounted(async () => {
  if (id.value) {
    const b = await getBeneficiary(id.value)
    if (b) {
      Object.assign(form, b)
      if (b.birthDate) birthDate.value = new Date(b.birthDate)
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

async function save() {
  error.value = ''
  if (!form.fullName.trim()) return (error.value = 'Ad soyad zorunludur.')

  // Yer tutucu TC (örn. 11111111111) gerçek TC'si olmayan kişiler için kullanılır:
  // algoritmik doğrulamadan ve benzersizlik kontrolünden muaftır.
  const isPlaceholder = isPlaceholderTc(form.nationalId)
  if (!isPlaceholder && !isValidTcKimlik(form.nationalId)) {
    return (error.value = 'Geçersiz TC Kimlik numarası.')
  }

  if (!isEdit.value && !isPlaceholder) {
    const existing = await findByNationalId(form.nationalId)
    if (existing) return (error.value = `Bu TC numarası ile kayıt mevcut: ${existing.fullName}`)
  }

  saving.value = true
  try {
    if (birthDate.value) form.birthDate = birthDate.value.toISOString().slice(0, 10)
    if (isEdit.value && id.value) {
      await updateBeneficiary(id.value, form)
      toast.add({ severity: 'success', summary: 'Güncellendi', detail: 'Muhtaç kaydı güncellendi.', life: 3000 })
      router.push({ name: 'beneficiary-detail', params: { id: id.value } })
    } else {
      const newId = await createBeneficiary(form)
      toast.add({ severity: 'success', summary: 'Kaydedildi', detail: 'Yeni muhtaç kaydı oluşturuldu.', life: 3000 })
      router.push({ name: 'beneficiary-detail', params: { id: newId } })
    }
  } catch (e) {
    error.value = (e as Error).message
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
        <p class="page__subtitle">Tüm bilgileri eksiksiz doldurun. TC Kimlik numarası benzersiz olmalıdır.</p>
      </div>
      <Button label="İptal" severity="secondary" text @click="router.back()" />
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <form class="card" @submit.prevent="save">
      <h3 class="section">Kişisel Bilgiler</h3>
      <div class="grid">
        <div class="field"><label>Ad Soyad *</label><InputText v-model="form.fullName" fluid /></div>
        <div class="field"><label>TC Kimlik *</label><InputText v-model="form.nationalId" maxlength="11" fluid /></div>
        <div class="field"><label>Doğum Tarihi</label><DatePicker v-model="birthDate" date-format="dd.mm.yy" show-icon fluid /></div>
        <div class="field"><label>Cinsiyet</label><Select v-model="form.gender" :options="genderOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid /></div>
        <div class="field"><label>Medeni Durum</label><Select v-model="form.maritalStatus" :options="maritalOptions" option-label="label" option-value="value" placeholder="Seçiniz" fluid /></div>
        <div class="field"><label>Telefon</label><InputText v-model="form.phone" fluid /></div>
        <div class="field"><label>Alternatif Telefon</label><InputText v-model="form.phoneAlt" fluid /></div>
        <div class="field"><label>E-posta</label><InputText v-model="form.email" fluid /></div>
      </div>

      <h3 class="section">Adres</h3>
      <div class="grid">
        <div class="field"><label>Şehir</label><InputText v-model="form.address.city" fluid /></div>
        <div class="field"><label>İlçe</label><InputText v-model="form.address.district" fluid /></div>
        <div class="field"><label>Mahalle</label><InputText v-model="form.address.neighborhood" fluid /></div>
        <div class="field field--full"><label>Açık Adres</label><Textarea v-model="form.address.fullAddress" rows="2" fluid /></div>
      </div>

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

      <h3 class="section">Aile Bireyleri
        <Button type="button" icon="pi pi-plus" label="Ekle" size="small" text @click="addFamilyMember" />
      </h3>
      <div v-for="(fm, i) in form.familyMembers" :key="i" class="member">
        <div class="member__head">
          <span class="member__index">#{{ i + 1 }}</span>
          <Button type="button" icon="pi pi-trash" severity="danger" text rounded @click="removeFamilyMember(i)" />
        </div>
        <div class="grid">
          <div class="field"><label>Ad Soyad</label><InputText v-model="fm.fullName" fluid /></div>
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

      <div class="actions">
        <Button type="button" label="İptal" severity="secondary" text @click="router.back()" />
        <Button type="submit" :label="isEdit ? 'Güncelle' : 'Kaydet'" icon="pi pi-check" :loading="saving" />
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
}

.member {
  padding: $spacing-md; margin-bottom: $spacing-md;
  background: $gray-50; border: 1px solid $gray-200; border-radius: $radius-md;
  display: flex; flex-direction: column; gap: $spacing-md;
}
.member__head { display: flex; justify-content: space-between; align-items: center; }
.member__index { font-weight: 600; color: $gray-600; }
.checks { display: flex; flex-wrap: wrap; gap: $spacing-lg;
  .check { display: flex; align-items: center; gap: $spacing-sm; color: $gray-700; font-size: $font-size-sm; cursor: pointer; }
}

.appliances { display: flex; flex-direction: column; gap: $spacing-sm; }
.appliance { display: grid; grid-template-columns: 2fr 1.2fr 2fr auto; gap: $spacing-sm; align-items: center; }

.actions { display: flex; justify-content: flex-end; gap: $spacing-md; margin-top: $spacing-xl; padding-top: $spacing-lg; border-top: 1px solid $gray-100; }

@media (max-width: $breakpoint-md) {
  .card { padding: $spacing-md; }
  .page__header { flex-wrap: wrap; gap: $spacing-md; }
  .grid { grid-template-columns: 1fr; }
  .grid--row,
  .appliance { grid-template-columns: 1fr; }
}
</style>
