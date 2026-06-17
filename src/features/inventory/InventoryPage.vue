<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import {
  listInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, recordMovement,
} from '@/services/inventory'
import type { InventoryItem, InventoryCategory, InventoryMovementType } from '@/types'
import { InventoryCategoryLabels } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

const toast = useToast()
const confirm = useConfirm()
const auth = useAuthStore()

const items = ref<InventoryItem[]>([])
const loading = ref(false)

const categoryOptions = Object.entries(InventoryCategoryLabels).map(([value, label]) => ({ label, value }))

const itemDialog = ref(false)
const editing = ref<Partial<InventoryItem>>({})
const saving = ref(false)

const moveDialog = ref(false)
const moveTarget = ref<InventoryItem | null>(null)
const moveForm = ref<{ type: InventoryMovementType; quantity: number; reason: string }>({
  type: 'in', quantity: 0, reason: '',
})

async function refresh() {
  loading.value = true
  try { items.value = await listInventory() } finally { loading.value = false }
}

function openNew() { editing.value = { name: '', category: 'other' as InventoryCategory, unit: 'adet', quantity: 0 }; itemDialog.value = true }
function openEdit(it: InventoryItem) { editing.value = { ...it }; itemDialog.value = true }

async function saveItem() {
  if (!editing.value.name?.trim()) return
  saving.value = true
  try {
    const { id, ...rest } = editing.value
    const payload = {
      name: rest.name!, category: rest.category as InventoryCategory,
      unit: rest.unit ?? 'adet', quantity: rest.quantity ?? 0,
      lowStockThreshold: rest.lowStockThreshold, location: rest.location, note: rest.note,
    }
    if (id) await updateInventoryItem(id, payload)
    else await createInventoryItem(payload)
    toast.add({ severity: 'success', summary: 'Kaydedildi', life: 2500 })
    itemDialog.value = false
    refresh()
  } finally { saving.value = false }
}

function confirmDeleteItem(it: InventoryItem) {
  confirm.require({
    message: `"${it.name}" silinsin mi?`, header: 'Silme Onayı',
    icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sil', rejectLabel: 'Vazgeç',
    acceptClass: 'p-button-danger',
    accept: async () => { await deleteInventoryItem(it.id); refresh() },
  })
}

function openMove(it: InventoryItem, type: InventoryMovementType) {
  moveTarget.value = it
  moveForm.value = { type, quantity: 0, reason: '' }
  moveDialog.value = true
}

async function saveMove() {
  if (!moveTarget.value || moveForm.value.quantity <= 0) return
  await recordMovement(moveTarget.value.id, moveForm.value.type, moveForm.value.quantity, {
    reason: moveForm.value.reason, performedBy: auth.firebaseUser?.uid,
  })
  toast.add({ severity: 'success', summary: 'Hareket kaydedildi', life: 2500 })
  moveDialog.value = false
  refresh()
}

function isLow(it: InventoryItem) {
  return typeof it.lowStockThreshold === 'number' && it.quantity <= it.lowStockThreshold
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Envanter</h2>
        <p class="page__subtitle">Stok kalemleri ve giriş/çıkış hareketleri.</p>
      </div>
      <Button v-if="auth.can('inventory','create')" label="Yeni Kalem" icon="pi pi-plus" @click="openNew" />
    </div>

    <div class="card hide-mobile">
      <DataTable :value="items" :loading="loading" :rows="25" paginator striped-rows row-hover>
        <template #empty><div class="empty">Envanter boş.</div></template>
        <Column field="name" header="Ad" sortable />
        <Column header="Kategori">
          <template #body="{ data }">{{ InventoryCategoryLabels[data.category as InventoryCategory] }}</template>
        </Column>
        <Column header="Stok" sortable sort-field="quantity">
          <template #body="{ data }">
            <Tag :severity="isLow(data) ? 'danger' : data.quantity === 0 ? 'secondary' : 'success'"
                 :value="`${data.quantity} ${data.unit}`" />
          </template>
        </Column>
        <Column header="Kritik Seviye">
          <template #body="{ data }">{{ data.lowStockThreshold ?? '—' }}</template>
        </Column>
        <Column field="location" header="Konum" />
        <Column header="Son Güncelleme">
          <template #body="{ data }">{{ formatDateTime(data.updatedAt) }}</template>
        </Column>
        <Column header="İşlem" style="width: 14rem">
          <template #body="{ data }">
            <Button v-if="auth.can('inventory','update')" icon="pi pi-plus-circle" text rounded severity="success" v-tooltip="'Giriş'" @click="openMove(data, 'in')" />
            <Button v-if="auth.can('inventory','update')" icon="pi pi-minus-circle" text rounded severity="warn" v-tooltip="'Çıkış'" @click="openMove(data, 'out')" />
            <Button v-if="auth.can('inventory','update')" icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(data)" />
            <Button v-if="auth.can('inventory','delete')" icon="pi pi-trash" text rounded severity="danger" @click="confirmDeleteItem(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Mobil kart listesi -->
    <div class="list-cards">
      <div v-for="it in items" :key="it.id" class="list-card">
        <div class="list-card__head">
          <div>
            <div class="list-card__title">{{ it.name }}</div>
            <div class="list-card__sub">{{ InventoryCategoryLabels[it.category as InventoryCategory] }}</div>
          </div>
          <Tag
            :severity="isLow(it) ? 'danger' : it.quantity === 0 ? 'secondary' : 'success'"
            :value="`${it.quantity} ${it.unit}`"
          />
        </div>
        <div class="list-card__meta">
          <span v-if="it.location"><i class="pi pi-map-marker" /> {{ it.location }}</span>
          <span v-if="it.lowStockThreshold != null"><i class="pi pi-exclamation-triangle" /> Kritik: {{ it.lowStockThreshold }}</span>
        </div>
        <div v-if="auth.can('inventory','update') || auth.can('inventory','delete')" class="list-card__actions">
          <Button v-if="auth.can('inventory','update')" icon="pi pi-plus-circle" text rounded severity="success" v-tooltip="'Giriş'" @click="openMove(it, 'in')" />
          <Button v-if="auth.can('inventory','update')" icon="pi pi-minus-circle" text rounded severity="warn" v-tooltip="'Çıkış'" @click="openMove(it, 'out')" />
          <Button v-if="auth.can('inventory','update')" icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(it)" />
          <Button v-if="auth.can('inventory','delete')" icon="pi pi-trash" text rounded severity="danger" @click="confirmDeleteItem(it)" />
        </div>
      </div>
      <div v-if="!loading && !items.length" class="empty">Envanter boş.</div>
    </div>

    <Dialog v-model:visible="itemDialog" modal :header="editing.id ? 'Kalem Düzenle' : 'Yeni Envanter Kalemi'" style="width: 520px">
      <div class="form">
        <div class="field"><label>Ad *</label><InputText v-model="editing.name" fluid /></div>
        <div class="row">
          <div class="field"><label>Kategori</label>
            <Select v-model="editing.category" :options="categoryOptions" option-label="label" option-value="value" fluid />
          </div>
          <div class="field"><label>Birim</label><InputText v-model="editing.unit" fluid /></div>
        </div>
        <div class="row">
          <div class="field"><label>Başlangıç Stoğu</label><InputNumber v-model="editing.quantity" :min="0" fluid /></div>
          <div class="field"><label>Kritik Seviye</label><InputNumber v-model="editing.lowStockThreshold" :min="0" fluid /></div>
        </div>
        <div class="field"><label>Konum</label><InputText v-model="editing.location" fluid /></div>
        <div class="field"><label>Not</label><Textarea v-model="editing.note" rows="2" fluid /></div>
      </div>
      <template #footer>
        <Button label="İptal" severity="secondary" text @click="itemDialog = false" />
        <Button label="Kaydet" icon="pi pi-check" :loading="saving" @click="saveItem" />
      </template>
    </Dialog>

    <Dialog v-model:visible="moveDialog" modal :header="`${moveForm.type === 'in' ? 'Stok Girişi' : 'Stok Çıkışı'} — ${moveTarget?.name}`" style="width: 420px">
      <div class="form">
        <div class="field"><label>Miktar *</label>
          <InputNumber v-model="moveForm.quantity" :min="1" fluid />
        </div>
        <div class="field"><label>Açıklama</label>
          <Textarea v-model="moveForm.reason" rows="2" fluid />
        </div>
      </div>
      <template #footer>
        <Button label="İptal" severity="secondary" text @click="moveDialog = false" />
        <Button label="Kaydet" icon="pi pi-check" @click="saveMove" />
      </template>
    </Dialog>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: flex-end; }
.page__title { font-size: $font-size-2xl; font-weight: 700; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
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
