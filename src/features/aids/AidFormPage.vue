<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { createAid } from '@/services/aids'
import { recordMovement, listInventory } from '@/services/inventory'
import { getBeneficiary, searchBeneficiaries } from '@/services/beneficiaries'
import { searchDonors } from '@/services/donors'
import type { Aid, AidType, AidStatus, AidItem, Beneficiary, Donor, InventoryItem } from '@/types'
import { AidTypeLabels, AidStatusLabels } from '@/types'
import { useAuthStore } from '@/stores/auth'

import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const auth = useAuthStore()

const typeOptions = Object.entries(AidTypeLabels).map(([value, label]) => ({ label, value }))
const statusOptions = Object.entries(AidStatusLabels).map(([value, label]) => ({ label, value }))

type DonorSource = 'registered' | 'manual' | 'none'

type Form = {
  beneficiary: Beneficiary | null
  type: AidType
  status: AidStatus
  amount: number | null
  items: (AidItem & { _inventoryRef?: InventoryItem })[]
  deliveredAt: Date | null
  note: string
  donorSource: DonorSource
  donor: Donor | null
  manualDonorName: string
}

const form = reactive<Form>({
  beneficiary: null, type: 'cash', status: 'delivered',
  amount: null, items: [], deliveredAt: new Date(), note: '',
  donorSource: 'none', donor: null, manualDonorName: '',
})

const suggestions = ref<Beneficiary[]>([])
const donorSuggestions = ref<Donor[]>([])
const inventory = ref<InventoryItem[]>([])

const donorSourceOptions = [
  { label: 'Bağışçı belirtme', value: 'none' },
  { label: 'Kayıtlı bağışçıdan seç', value: 'registered' },
  { label: 'Manuel ad gir', value: 'manual' },
]
const error = ref('')
const saving = ref(false)

onMounted(async () => {
  inventory.value = await listInventory()
  const bId = route.query.beneficiaryId as string | undefined
  if (bId) {
    form.beneficiary = await getBeneficiary(bId)
  }
})

async function searchBen(e: { query: string }) {
  suggestions.value = await searchBeneficiaries(e.query, 10)
}

async function searchDonorList(e: { query: string }) {
  donorSuggestions.value = await searchDonors(e.query, 10)
}

function addItem() {
  form.items.push({ name: '', quantity: 1, unit: 'adet' } as AidItem)
}
function removeItem(i: number) { form.items.splice(i, 1) }

function onItemSelect(item: Form['items'][number], inv: InventoryItem) {
  item.inventoryId = inv.id
  item.name = inv.name
  item.unit = inv.unit
  item._inventoryRef = inv
}

async function save() {
  error.value = ''
  if (!form.beneficiary) return (error.value = 'Muhtaç seçimi zorunludur.')
  if (form.type === 'cash' && (!form.amount || form.amount <= 0)) return (error.value = 'Nakdi yardım için tutar girilmelidir.')
  if (form.type !== 'cash' && form.items.length === 0) return (error.value = 'En az bir kalem eklenmelidir.')

  saving.value = true
  try {
    const donorId = form.donorSource === 'registered' ? form.donor?.id : undefined
    const donorName = form.donorSource === 'registered'
      ? form.donor?.fullName
      : form.donorSource === 'manual'
        ? form.manualDonorName.trim() || undefined
        : undefined

    const payload: Omit<Aid, 'id' | 'createdAt' | 'updatedAt'> = {
      beneficiaryId: form.beneficiary.id,
      beneficiaryName: form.beneficiary.fullName,
      type: form.type,
      status: form.status,
      amount: form.type === 'cash' ? form.amount ?? undefined : undefined,
      currency: form.type === 'cash' ? 'TRY' : undefined,
      items: form.type !== 'cash' ? form.items.map(({ _inventoryRef: _r, ...rest }) => rest) : undefined,
      donorId,
      donorName,
      deliveredAt: form.status === 'delivered' && form.deliveredAt ? form.deliveredAt : undefined,
      deliveredBy: auth.firebaseUser?.uid,
      deliveredByName: auth.profile?.fullName,
      note: form.note,
    }
    const aidId = await createAid(payload)

    // Envanter düş
    if (form.status === 'delivered' && form.items.length) {
      for (const item of form.items) {
        if (item.inventoryId && item.quantity > 0) {
          await recordMovement(item.inventoryId, 'out', item.quantity, {
            aidId, reason: `Yardım: ${form.beneficiary.fullName}`, performedBy: auth.firebaseUser?.uid,
          })
        }
      }
    }

    toast.add({ severity: 'success', summary: 'Kaydedildi', detail: 'Yardım kaydı oluşturuldu.', life: 3000 })
    router.push({ name: 'beneficiary-detail', params: { id: form.beneficiary.id } })
  } catch (e) {
    error.value = (e as Error).message
  } finally { saving.value = false }
}
</script>

<template>
  <div class="page">
    <div class="page__header">
      <h2 class="page__title">Yeni Yardım Kaydı</h2>
      <Button label="İptal" severity="secondary" text @click="router.back()" />
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <form class="card" @submit.prevent="save">
      <div class="grid">
        <div class="field field--full">
          <label>Muhtaç *</label>
          <AutoComplete
            v-model="form.beneficiary" :suggestions="suggestions" option-label="fullName"
            placeholder="İsim veya TC ile arayın…" @complete="searchBen" fluid :force-selection="true"
          >
            <template #option="{ option }">
              <div class="sugg">
                <strong>{{ option.fullName }}</strong>
                <span class="muted">{{ option.nationalId }} · {{ option.address?.city || '—' }}</span>
              </div>
            </template>
          </AutoComplete>
        </div>
        <div class="field"><label>Yardım Türü *</label>
          <Select v-model="form.type" :options="typeOptions" option-label="label" option-value="value" fluid />
        </div>
        <div class="field"><label>Durum</label>
          <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" fluid />
        </div>
        <div v-if="form.type === 'cash'" class="field"><label>Tutar (TRY) *</label>
          <InputNumber v-model="form.amount" mode="currency" currency="TRY" locale="tr-TR" fluid />
        </div>
        <div class="field"><label>Teslim Tarihi</label>
          <DatePicker v-model="form.deliveredAt" show-time date-format="dd.mm.yy" fluid show-icon />
        </div>

        <div class="field"><label>Bağışçı</label>
          <Select v-model="form.donorSource" :options="donorSourceOptions" option-label="label" option-value="value" fluid />
        </div>
        <div v-if="form.donorSource === 'registered'" class="field">
          <label>Kayıtlı Bağışçı</label>
          <AutoComplete
            v-model="form.donor" :suggestions="donorSuggestions" option-label="fullName"
            placeholder="Ad, telefon veya vergi no ile ara…" @complete="searchDonorList"
            fluid :force-selection="true"
          >
            <template #option="{ option }">
              <div class="sugg">
                <strong>{{ option.fullName }}</strong>
                <span class="muted">{{ option.type === 'corporate' ? 'Kurumsal' : 'Bireysel' }} · {{ option.phone || option.email || '—' }}</span>
              </div>
            </template>
          </AutoComplete>
        </div>
        <div v-else-if="form.donorSource === 'manual'" class="field">
          <label>Bağışçı Adı</label>
          <InputText v-model="form.manualDonorName" placeholder="Ör. Ahmet Yılmaz" fluid />
        </div>
      </div>

      <div v-if="form.type !== 'cash'" class="items">
        <div class="items__header">
          <h3>Kalemler</h3>
          <Button type="button" icon="pi pi-plus" label="Kalem Ekle" size="small" text @click="addItem" />
        </div>
        <div v-for="(it, i) in form.items" :key="i" class="item-row">
          <Select
            v-model="it._inventoryRef" :options="inventory" option-label="name"
            placeholder="Envanterden seç (opsiyonel)" fluid
            @change="(e) => onItemSelect(it, e.value)"
          />
          <InputText v-model="it.name" placeholder="Kalem adı" fluid />
          <InputNumber v-model="it.quantity" :min="1" placeholder="Adet" fluid />
          <InputText v-model="it.unit" placeholder="Birim" fluid />
          <Button type="button" icon="pi pi-trash" severity="danger" text @click="removeItem(i)" />
        </div>
      </div>

      <div class="field"><label>Not</label><Textarea v-model="form.note" rows="3" fluid /></div>

      <div class="actions">
        <Button type="button" label="İptal" severity="secondary" text @click="router.back()" />
        <Button type="submit" label="Kaydet" icon="pi pi-check" :loading="saving" />
      </div>
    </form>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: center; }
.page__title { font-size: $font-size-2xl; font-weight: 700; margin: 0; }
.card { background: $white; border-radius: $radius-lg; padding: $spacing-xl; box-shadow: $shadow-sm; border: 1px solid $gray-200; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: $spacing-md; }
.field { display: flex; flex-direction: column; gap: $spacing-xs;
  label { font-size: $font-size-sm; font-weight: 500; color: $gray-700; }
  &--full { grid-column: 1 / -1; }
}
.sugg { display: flex; flex-direction: column;
  .muted { color: $gray-500; font-size: $font-size-sm; }
}
.items { margin: $spacing-xl 0; padding: $spacing-md; background: $gray-50; border-radius: $radius-md; }
.items__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: $spacing-md;
  h3 { margin: 0; font-size: $font-size-lg; }
}
.item-row { display: grid; grid-template-columns: 2fr 2fr 1fr 1fr auto; gap: $spacing-sm; margin-bottom: $spacing-sm; align-items: center; }
.actions { display: flex; justify-content: flex-end; gap: $spacing-md; margin-top: $spacing-xl; padding-top: $spacing-lg; border-top: 1px solid $gray-100; }

@media (max-width: $breakpoint-md) {
  .card { padding: $spacing-md; }
  .page__header { flex-wrap: wrap; gap: $spacing-md; }
  .grid { grid-template-columns: 1fr; }
  .item-row { grid-template-columns: 1fr; }
}
</style>
