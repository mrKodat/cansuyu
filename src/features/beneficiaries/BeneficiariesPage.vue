<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listBeneficiaries, searchBeneficiaries } from '@/services/beneficiaries'
import type { Beneficiary, NeedLevel } from '@/types'
import { NeedLevelLabels } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { formatPhone } from '@/utils/format'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const router = useRouter()
const auth = useAuthStore()

const items = ref<Beneficiary[]>([])
const loading = ref(false)
const search = ref('')
const needFilter = ref<NeedLevel | null>(null)
const cityFilter = ref('')

const needLevelOptions = [
  { label: 'Tümü', value: null },
  { label: 'Kritik', value: 'critical' },
  { label: 'Yüksek', value: 'high' },
  { label: 'Orta', value: 'medium' },
  { label: 'Düşük', value: 'low' },
]

async function refresh() {
  loading.value = true
  try {
    items.value = search.value.trim()
      ? await searchBeneficiaries(search.value)
      : await listBeneficiaries()
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(refresh, 250)
})

const filtered = computed(() =>
  items.value.filter((b) => {
    if (needFilter.value && b.needLevel !== needFilter.value) return false
    if (cityFilter.value && !b.address?.city?.toLowerCase().includes(cityFilter.value.toLowerCase())) return false
    return true
  }),
)

const needSeverity = (n: NeedLevel) =>
  n === 'critical' ? 'danger' : n === 'high' ? 'warn' : n === 'medium' ? 'info' : 'secondary'

function goDetail(b: Beneficiary) { router.push({ name: 'beneficiary-detail', params: { id: b.id } }) }

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Muhtaç Kayıtları</h2>
        <p class="page__subtitle">İsim, TC kimlik, telefon veya adres ile arama yapabilirsiniz.</p>
      </div>
      <Button
        v-if="auth.can('beneficiaries', 'create')"
        label="Yeni Muhtaç" icon="pi pi-plus" severity="primary"
        @click="router.push({ name: 'beneficiary-new' })"
      />
    </div>

    <div class="filters">
      <IconField class="filters__search">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="İsim, TC, telefon, mahalle…" fluid />
      </IconField>
      <Select v-model="needFilter" :options="needLevelOptions" option-label="label" option-value="value" placeholder="Muhtaçlık Seviyesi" class="filters__select" />
      <InputText v-model="cityFilter" placeholder="Şehir" class="filters__city" />
    </div>

    <div class="card hide-mobile">
      <DataTable
        :value="filtered" :loading="loading" :rows="25" paginator
        striped-rows removable-sort row-hover data-key="id"
        @row-click="(e) => goDetail(e.data as Beneficiary)"
        class="cursor-table"
      >
        <template #empty><div class="empty">Kayıt bulunamadı.</div></template>
        <Column field="fullName" header="Ad Soyad" sortable />
        <Column field="nationalId" header="TC Kimlik" sortable />
        <Column header="Telefon">
          <template #body="{ data }">{{ formatPhone(data.phone) }}</template>
        </Column>
        <Column header="Şehir / İlçe">
          <template #body="{ data }">
            <span>{{ data.address?.city || '—' }}<span v-if="data.address?.district"> / {{ data.address.district }}</span></span>
          </template>
        </Column>
        <Column header="Muhtaçlık" sortable sort-field="needLevel">
          <template #body="{ data }">
            <Tag :severity="needSeverity(data.needLevel)" :value="NeedLevelLabels[data.needLevel as NeedLevel]" />
          </template>
        </Column>
        <Column header="Bağımlı">
          <template #body="{ data }">{{ data.dependentCount ?? 0 }} kişi</template>
        </Column>
        <Column header="" style="width: 4rem">
          <template #body="{ data }">
            <Button icon="pi pi-arrow-right" text rounded severity="secondary" @click.stop="goDetail(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Mobil kart listesi -->
    <div class="list-cards">
      <div
        v-for="b in filtered" :key="b.id"
        class="list-card list-card--tappable" @click="goDetail(b)"
      >
        <div class="list-card__head">
          <div>
            <div class="list-card__title">{{ b.fullName }}</div>
            <div class="list-card__sub">{{ b.nationalId }}</div>
          </div>
          <Tag :severity="needSeverity(b.needLevel)" :value="NeedLevelLabels[b.needLevel as NeedLevel]" />
        </div>
        <div class="list-card__meta">
          <span v-if="b.phone"><i class="pi pi-phone" /> {{ formatPhone(b.phone) }}</span>
          <span><i class="pi pi-map-marker" /> {{ b.address?.city || '—' }}<template v-if="b.address?.district"> / {{ b.address.district }}</template></span>
          <span><i class="pi pi-users" /> {{ b.dependentCount ?? 0 }} bağımlı</span>
        </div>
      </div>
      <div v-if="!loading && !filtered.length" class="empty">Kayıt bulunamadı.</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: flex-end; gap: $spacing-lg; flex-wrap: wrap; }
.page__title { font-size: $font-size-2xl; font-weight: 700; color: $gray-900; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
.filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: $spacing-md; }
@media (max-width: $breakpoint-md) { .filters { grid-template-columns: 1fr; } }
.filters__search { width: 100%; }
.card { background: $white; border-radius: $radius-lg; padding: $spacing-md; box-shadow: $shadow-sm; border: 1px solid $gray-200; }
.empty { text-align: center; padding: $spacing-xl; color: $gray-500; }
:deep(.cursor-table tr[role="row"]) { cursor: pointer; }
</style>
