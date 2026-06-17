<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useRouter } from 'vue-router'
import { listApplications, updateApplication, deleteApplication } from '@/services/applications'
import { createBeneficiary, findByNationalId } from '@/services/beneficiaries'
import type { Application, ApplicationStatus } from '@/types'
import { ApplicationStatusLabels } from '@/types'
import { formatDateTime, formatCurrency, formatPhone } from '@/utils/format'
import { isValidTcKimlik } from '@/utils/search'
import { useAuthStore } from '@/stores/auth'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

const toast = useToast()
const confirm = useConfirm()
const router = useRouter()
const auth = useAuthStore()

const items = ref<Application[]>([])
const loading = ref(false)
const statusFilter = ref<ApplicationStatus | null>(null)

const statusOptions = [
  { label: 'Tümü', value: null },
  ...Object.entries(ApplicationStatusLabels).map(([value, label]) => ({ label, value })),
]

const detailDialog = ref(false)
const current = ref<Application | null>(null)
const reviewNote = ref('')

async function refresh() {
  loading.value = true
  try { items.value = await listApplications(statusFilter.value ?? undefined) } finally { loading.value = false }
}

function statusSeverity(s: ApplicationStatus) {
  return s === 'approved' || s === 'converted' ? 'success'
    : s === 'rejected' ? 'danger'
    : s === 'in_review' ? 'info' : 'warn'
}

function openDetail(a: Application) {
  current.value = a
  reviewNote.value = a.note ?? ''
  detailDialog.value = true
}

async function setStatus(status: ApplicationStatus) {
  if (!current.value) return
  await updateApplication(current.value.id, {
    status, note: reviewNote.value,
    reviewedBy: auth.firebaseUser?.uid,
  } as Partial<Application>)
  toast.add({ severity: 'success', summary: 'Güncellendi', life: 2500 })
  detailDialog.value = false
  refresh()
}

async function convertToBeneficiary() {
  if (!current.value) return
  const a = current.value
  if (!a.nationalId || !isValidTcKimlik(a.nationalId)) {
    toast.add({ severity: 'error', summary: 'TC Kimlik gerekli ve geçerli olmalı', life: 4000 })
    return
  }
  const existing = await findByNationalId(a.nationalId)
  if (existing) {
    toast.add({ severity: 'warn', summary: 'Bu TC ile kayıt zaten var', life: 4000 })
    router.push({ name: 'beneficiary-detail', params: { id: existing.id } })
    return
  }
  const id = await createBeneficiary({
    fullName: a.fullName, nationalId: a.nationalId,
    phone: a.phone, email: a.email,
    address: { city: a.city, district: a.district, fullAddress: a.address },
    familyMembers: [], dependentCount: a.dependentCount ?? 0,
    needLevel: 'medium', needNotes: a.reason,
    householdAppliances: [],
    incomes: a.monthlyIncome ? [{ type: 'Beyan', monthlyAmount: a.monthlyIncome }] : [],
    governmentBenefits: [], externalAidRecords: [],
    active: true, createdBy: auth.firebaseUser?.uid,
  })
  await updateApplication(a.id, {
    status: 'converted', convertedBeneficiaryId: id,
    reviewedBy: auth.firebaseUser?.uid, note: reviewNote.value,
  } as Partial<Application>)
  toast.add({ severity: 'success', summary: 'Muhtaç kaydına dönüştürüldü', life: 3000 })
  detailDialog.value = false
  router.push({ name: 'beneficiary-detail', params: { id } })
}

function confirmDel(a: Application) {
  confirm.require({
    message: 'Bu başvuru silinsin mi?', header: 'Silme Onayı',
    icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sil', rejectLabel: 'Vazgeç',
    acceptClass: 'p-button-danger',
    accept: async () => { await deleteApplication(a.id); refresh() },
  })
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Yardım Başvuruları</h2>
        <p class="page__subtitle">Web formundan veya manuel gelen başvurular. Değerlendirip muhtaç kaydına dönüştürebilirsiniz.</p>
      </div>
      <Select v-model="statusFilter" :options="statusOptions" option-label="label" option-value="value" placeholder="Durum" @change="refresh" />
    </div>

    <Message severity="info" :closable="false">
      Web sitenizden gelecek başvurular <code>applications</code> koleksiyonuna düşecek şekilde tasarlandı. Şu anda manuel ve otomatik eklemeler aynı arayüzde görüntülenir.
    </Message>

    <div class="card">
      <DataTable :value="items" :loading="loading" :rows="25" paginator striped-rows row-hover
                 @row-click="(e) => openDetail(e.data as Application)" class="cursor-table">
        <template #empty><div class="empty">Başvuru yok.</div></template>
        <Column header="Tarih"><template #body="{ data }">{{ formatDateTime(data.createdAt) }}</template></Column>
        <Column field="fullName" header="Başvuran" sortable />
        <Column header="Telefon"><template #body="{ data }">{{ formatPhone(data.phone) }}</template></Column>
        <Column field="city" header="Şehir" />
        <Column header="Kaynak">
          <template #body="{ data }">
            <Tag :value="data.source === 'web' ? 'Web' : data.source === 'phone' ? 'Telefon' : 'Yerinde'" severity="secondary" />
          </template>
        </Column>
        <Column header="Durum">
          <template #body="{ data }">
            <Tag :severity="statusSeverity(data.status as ApplicationStatus)" :value="ApplicationStatusLabels[data.status as ApplicationStatus]" />
          </template>
        </Column>
        <Column header="" style="width:4rem">
          <template #body="{ data }">
            <Button icon="pi pi-trash" text rounded severity="danger" @click.stop="confirmDel(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="detailDialog" modal header="Başvuru Detayı" style="width: 640px">
      <div v-if="current" class="detail">
        <dl class="kv">
          <dt>Ad Soyad</dt><dd>{{ current.fullName }}</dd>
          <dt>TC Kimlik</dt><dd>{{ current.nationalId || '—' }}</dd>
          <dt>Telefon</dt><dd>{{ formatPhone(current.phone) }}</dd>
          <dt>E-posta</dt><dd>{{ current.email || '—' }}</dd>
          <dt>Şehir / İlçe</dt><dd>{{ current.city || '—' }} / {{ current.district || '—' }}</dd>
          <dt>Adres</dt><dd>{{ current.address || '—' }}</dd>
          <dt>Bakmakla Yükümlü</dt><dd>{{ current.dependentCount ?? '—' }}</dd>
          <dt>Aylık Gelir</dt><dd>{{ formatCurrency(current.monthlyIncome) }}</dd>
          <dt>Durum</dt><dd><Tag :severity="statusSeverity(current.status as ApplicationStatus)" :value="ApplicationStatusLabels[current.status as ApplicationStatus]" /></dd>
          <dt>Başvuru Tarihi</dt><dd>{{ formatDateTime(current.createdAt) }}</dd>
        </dl>
        <div class="reason">
          <h4>Başvuru Gerekçesi</h4>
          <p>{{ current.reason || '—' }}</p>
        </div>
        <div class="field">
          <label>Değerlendirme Notu</label>
          <Textarea v-model="reviewNote" rows="3" fluid />
        </div>
      </div>
      <template #footer>
        <Button label="Reddet" severity="danger" text @click="setStatus('rejected')" />
        <Button label="İncelemeye Al" severity="secondary" @click="setStatus('in_review')" />
        <Button label="Onayla" severity="success" @click="setStatus('approved')" />
        <Button label="Muhtaç Kaydına Dönüştür" icon="pi pi-user-plus" @click="convertToBeneficiary" />
      </template>
    </Dialog>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: flex-end; }
@media (max-width: $breakpoint-md) {
  .page__header { flex-wrap: wrap; gap: $spacing-md; }
  .kv { grid-template-columns: 1fr; gap: 0 0; }
}
.page__title { font-size: $font-size-2xl; font-weight: 700; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
.card { background: $white; border-radius: $radius-lg; padding: $spacing-md; box-shadow: $shadow-sm; border: 1px solid $gray-200; }
.empty { text-align: center; padding: $spacing-xl; color: $gray-500; }
:deep(.cursor-table tr[role="row"]) { cursor: pointer; }

.detail { display: flex; flex-direction: column; gap: $spacing-lg; }
.kv { display: grid; grid-template-columns: 160px 1fr; gap: $spacing-xs $spacing-md; margin: 0;
  dt { color: $gray-500; font-size: $font-size-sm; }
  dd { margin: 0; color: $gray-900; }
}
.reason { padding: $spacing-md; background: $gray-50; border-radius: $radius-md;
  h4 { margin: 0 0 $spacing-sm; color: $gray-700; }
  p { margin: 0; white-space: pre-wrap; line-height: 1.6; }
}
.field { display: flex; flex-direction: column; gap: $spacing-xs;
  label { font-size: $font-size-sm; font-weight: 500; color: $gray-700; }
}
</style>
