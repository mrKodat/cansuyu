<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { listDonors, searchDonors, createDonor, updateDonor, deleteDonor } from '@/services/donors'
import type { Donor, DonorType } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { formatPhone, formatCurrency } from '@/utils/format'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const toast = useToast()
const confirm = useConfirm()
const auth = useAuthStore()

const donors = ref<Donor[]>([])
const loading = ref(false)
const search = ref('')

const typeOptions = [
  { label: 'Bireysel', value: 'individual' },
  { label: 'Kurumsal', value: 'corporate' },
]

const dialogVisible = ref(false)
const editing = ref<Partial<Donor>>({})
const saving = ref(false)

async function refresh() {
  loading.value = true
  try {
    donors.value = search.value.trim() ? await searchDonors(search.value) : await listDonors()
  } finally {
    loading.value = false
  }
}

let t: ReturnType<typeof setTimeout> | null = null
watch(search, () => { if (t) clearTimeout(t); t = setTimeout(refresh, 250) })

function openNew() {
  editing.value = { type: 'individual' as DonorType, fullName: '', phone: '', email: '' }
  dialogVisible.value = true
}
function openEdit(d: Donor) {
  editing.value = { ...d }
  dialogVisible.value = true
}

async function save() {
  if (!editing.value.fullName?.trim()) return
  saving.value = true
  try {
    const { id, ...rest } = editing.value
    const payload = {
      type: rest.type as DonorType,
      fullName: rest.fullName!,
      nationalId: rest.nationalId,
      taxNumber: rest.taxNumber,
      phone: rest.phone,
      email: rest.email,
      address: rest.address,
      city: rest.city,
      note: rest.note,
    }
    if (id) {
      await updateDonor(id, payload)
      toast.add({ severity: 'success', summary: 'Güncellendi', life: 2500 })
    } else {
      await createDonor(payload)
      toast.add({ severity: 'success', summary: 'Eklendi', life: 2500 })
    }
    dialogVisible.value = false
    refresh()
  } finally { saving.value = false }
}

function confirmDelete(d: Donor) {
  confirm.require({
    message: `"${d.fullName}" silinsin mi?`, header: 'Silme Onayı',
    icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sil', rejectLabel: 'Vazgeç',
    acceptClass: 'p-button-danger',
    accept: async () => { await deleteDonor(d.id); toast.add({ severity: 'success', summary: 'Silindi', life: 2500 }); refresh() },
  })
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Bağışçılar</h2>
        <p class="page__subtitle">Bireysel ve kurumsal bağışçı kayıtları.</p>
      </div>
      <Button v-if="auth.can('donors','create')" label="Yeni Bağışçı" icon="pi pi-plus" @click="openNew" />
    </div>

    <IconField class="search">
      <InputIcon class="pi pi-search" />
      <InputText v-model="search" placeholder="Ad, telefon, e-posta, TC, vergi no…" fluid />
    </IconField>

    <div class="card hide-mobile">
      <DataTable :value="donors" :loading="loading" :rows="25" paginator striped-rows row-hover>
        <template #empty><div class="empty">Bağışçı bulunamadı.</div></template>
        <Column field="fullName" header="Ad / Unvan" sortable />
        <Column header="Tür">
          <template #body="{ data }">
            <Tag :severity="data.type === 'corporate' ? 'info' : 'secondary'" :value="data.type === 'corporate' ? 'Kurumsal' : 'Bireysel'" />
          </template>
        </Column>
        <Column header="Telefon"><template #body="{ data }">{{ formatPhone(data.phone) }}</template></Column>
        <Column field="email" header="E-posta" />
        <Column field="city" header="Şehir" />
        <Column header="Toplam Bağış">
          <template #body="{ data }">{{ formatCurrency(data.totalDonated) }}</template>
        </Column>
        <Column header="" style="width:8rem">
          <template #body="{ data }">
            <Button v-if="auth.can('donors','update')" icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(data)" />
            <Button v-if="auth.can('donors','delete')" icon="pi pi-trash" text rounded severity="danger" @click="confirmDelete(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Mobil kart listesi -->
    <div class="list-cards">
      <div v-for="d in donors" :key="d.id" class="list-card">
        <div class="list-card__head">
          <div>
            <div class="list-card__title">{{ d.fullName }}</div>
            <div class="list-card__sub">{{ d.city || '—' }}</div>
          </div>
          <Tag :severity="d.type === 'corporate' ? 'info' : 'secondary'" :value="d.type === 'corporate' ? 'Kurumsal' : 'Bireysel'" />
        </div>
        <div class="list-card__meta">
          <span v-if="d.phone"><i class="pi pi-phone" /> {{ formatPhone(d.phone) }}</span>
          <span v-if="d.email"><i class="pi pi-envelope" /> {{ d.email }}</span>
          <span><i class="pi pi-wallet" /> {{ formatCurrency(d.totalDonated) }}</span>
        </div>
        <div v-if="auth.can('donors','update') || auth.can('donors','delete')" class="list-card__actions">
          <Button v-if="auth.can('donors','update')" icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(d)" />
          <Button v-if="auth.can('donors','delete')" icon="pi pi-trash" text rounded severity="danger" @click="confirmDelete(d)" />
        </div>
      </div>
      <div v-if="!loading && !donors.length" class="empty">Bağışçı bulunamadı.</div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editing.id ? 'Bağışçı Düzenle' : 'Yeni Bağışçı'" style="width: 540px">
      <div class="form">
        <div class="field"><label>Tür</label>
          <Select v-model="editing.type" :options="typeOptions" option-label="label" option-value="value" fluid />
        </div>
        <div class="field"><label>Ad / Unvan *</label><InputText v-model="editing.fullName" fluid /></div>
        <div class="row">
          <div class="field"><label>Telefon</label><InputText v-model="editing.phone" fluid /></div>
          <div class="field"><label>E-posta</label><InputText v-model="editing.email" fluid /></div>
        </div>
        <div class="row">
          <div class="field"><label>TC Kimlik</label><InputText v-model="editing.nationalId" fluid /></div>
          <div class="field"><label>Vergi No</label><InputText v-model="editing.taxNumber" fluid /></div>
        </div>
        <div class="field"><label>Şehir</label><InputText v-model="editing.city" fluid /></div>
        <div class="field"><label>Adres</label><Textarea v-model="editing.address" rows="2" fluid /></div>
        <div class="field"><label>Not</label><Textarea v-model="editing.note" rows="2" fluid /></div>
      </div>
      <template #footer>
        <Button label="İptal" severity="secondary" text @click="dialogVisible = false" />
        <Button label="Kaydet" icon="pi pi-check" :loading="saving" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: flex-end; }
.page__title { font-size: $font-size-2xl; font-weight: 700; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
.search { max-width: 520px; }
.card { background: $white; border-radius: $radius-lg; padding: $spacing-md; box-shadow: $shadow-sm; border: 1px solid $gray-200; }
.empty { text-align: center; padding: $spacing-xl; color: $gray-500; }
.form { display: flex; flex-direction: column; gap: $spacing-md; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: $spacing-md; }
@media (max-width: $breakpoint-md) {
  .row { grid-template-columns: 1fr; }
  .page__header { flex-wrap: wrap; gap: $spacing-md; }
}
.field { display: flex; flex-direction: column; gap: $spacing-xs;
  label { font-size: $font-size-sm; font-weight: 500; color: $gray-700; }
}
</style>
