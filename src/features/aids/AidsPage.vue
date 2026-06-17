<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listAids, deleteAid } from '@/services/aids'
import type { Aid, AidType, AidStatus } from '@/types'
import { AidTypeLabels, AidStatusLabels } from '@/types'
import { formatDateTime, formatCurrency } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const items = ref<Aid[]>([])
const loading = ref(false)
const search = ref('')
const typeFilter = ref<AidType | null>(null)
const statusFilter = ref<AidStatus | null>(null)

const typeOptions = [
  { label: 'Tümü', value: null },
  ...Object.entries(AidTypeLabels).map(([value, label]) => ({ label, value })),
]
const statusOptions = [
  { label: 'Tümü', value: null },
  ...Object.entries(AidStatusLabels).map(([value, label]) => ({ label, value })),
]

async function refresh() {
  loading.value = true
  try { items.value = await listAids(500) } finally { loading.value = false }
}

const filtered = computed(() =>
  items.value.filter((a) => {
    if (typeFilter.value && a.type !== typeFilter.value) return false
    if (statusFilter.value && a.status !== statusFilter.value) return false
    if (search.value.trim()) {
      const q = search.value.toLowerCase()
      return a.beneficiaryName?.toLowerCase().includes(q) || a.note?.toLowerCase().includes(q)
    }
    return true
  }),
)

const statusSeverity = (s: AidStatus) =>
  s === 'delivered' ? 'success' : s === 'approved' ? 'info' : s === 'pending' ? 'warn' : 'danger'

function confirmDelete(a: Aid) {
  confirm.require({
    message: 'Bu yardım kaydı silinsin mi?', header: 'Silme Onayı',
    icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sil', rejectLabel: 'Vazgeç',
    acceptClass: 'p-button-danger',
    accept: async () => { await deleteAid(a.id); toast.add({ severity: 'success', summary: 'Silindi', life: 2500 }); refresh() },
  })
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Yardım Kayıtları</h2>
        <p class="page__subtitle">Tüm yardım işlemlerini görüntüleyin ve filtreleyin.</p>
      </div>
      <Button v-if="auth.can('aids','create')" label="Yeni Yardım" icon="pi pi-plus" @click="router.push({ name: 'aid-new' })" />
    </div>

    <div class="filters">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Muhtaç adı, not…" fluid />
      </IconField>
      <Select v-model="typeFilter" :options="typeOptions" option-label="label" option-value="value" placeholder="Tür" />
      <Select v-model="statusFilter" :options="statusOptions" option-label="label" option-value="value" placeholder="Durum" />
    </div>

    <div class="card hide-mobile">
      <DataTable
        :value="filtered" :loading="loading" :rows="25" paginator striped-rows row-hover
        data-key="id" class="cursor-table"
        @row-click="(e) => router.push({ name: 'aid-detail', params: { id: (e.data as Aid).id } })"
      >
        <template #empty><div class="empty">Yardım kaydı bulunamadı.</div></template>
        <Column header="Tarih" sortable>
          <template #body="{ data }">{{ formatDateTime(data.deliveredAt || data.createdAt) }}</template>
        </Column>
        <Column field="beneficiaryName" header="Muhtaç" sortable />
        <Column header="Tür">
          <template #body="{ data }">{{ AidTypeLabels[data.type as AidType] }}</template>
        </Column>
        <Column header="Miktar">
          <template #body="{ data }">
            <span v-if="data.amount">{{ formatCurrency(data.amount) }}</span>
            <span v-else-if="data.items?.length">{{ data.items.length }} kalem</span>
            <span v-else>—</span>
          </template>
        </Column>
        <Column header="Durum">
          <template #body="{ data }">
            <Tag :severity="statusSeverity(data.status)" :value="AidStatusLabels[data.status as AidStatus]" />
          </template>
        </Column>
        <Column field="deliveredByName" header="Temsilci" />
        <Column header="" style="width:8rem">
          <template #body="{ data }">
            <Button icon="pi pi-arrow-right" text rounded severity="secondary" @click.stop="router.push({ name: 'aid-detail', params: { id: data.id } })" />
            <Button v-if="auth.can('aids','delete')" icon="pi pi-trash" text rounded severity="danger" @click.stop="confirmDelete(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Mobil kart listesi -->
    <div class="list-cards">
      <div
        v-for="a in filtered" :key="a.id"
        class="list-card list-card--tappable"
        @click="router.push({ name: 'aid-detail', params: { id: a.id } })"
      >
        <div class="list-card__head">
          <div>
            <div class="list-card__title">{{ a.beneficiaryName || '—' }}</div>
            <div class="list-card__sub">{{ AidTypeLabels[a.type as AidType] }} · {{ formatDateTime(a.deliveredAt || a.createdAt) }}</div>
          </div>
          <Tag :severity="statusSeverity(a.status)" :value="AidStatusLabels[a.status as AidStatus]" />
        </div>
        <div class="list-card__meta">
          <span v-if="a.amount"><i class="pi pi-wallet" /> {{ formatCurrency(a.amount) }}</span>
          <span v-else-if="a.items?.length"><i class="pi pi-box" /> {{ a.items.length }} kalem</span>
          <span v-if="a.deliveredByName"><i class="pi pi-user" /> {{ a.deliveredByName }}</span>
        </div>
        <div v-if="auth.can('aids','delete')" class="list-card__actions">
          <Button icon="pi pi-trash" text rounded severity="danger" @click.stop="confirmDelete(a)" />
        </div>
      </div>
      <div v-if="!loading && !filtered.length" class="empty">Yardım kaydı bulunamadı.</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: flex-end; }
.page__title { font-size: $font-size-2xl; font-weight: 700; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
.filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: $spacing-md; }
@media (max-width: $breakpoint-md) {
  .filters { grid-template-columns: 1fr; }
  .page__header { flex-wrap: wrap; gap: $spacing-md; }
}
.card { background: $white; border-radius: $radius-lg; padding: $spacing-md; box-shadow: $shadow-sm; border: 1px solid $gray-200; }
.empty { text-align: center; padding: $spacing-xl; color: $gray-500; }
:deep(.cursor-table tr[role="row"]) { cursor: pointer; }
</style>
