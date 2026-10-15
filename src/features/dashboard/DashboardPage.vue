<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { countBeneficiaries } from '@/services/beneficiaries'
import { listAids, sumDeliveredAmount } from '@/services/aids'
import { listInventory } from '@/services/inventory'
import { listApplications, countApplications } from '@/services/applications'
import type { Aid, InventoryItem, Application } from '@/types'
import { AidTypeLabels } from '@/types'
import { formatDateTime, formatCurrency } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const router = useRouter()
const auth = useAuthStore()

// KPI'lar sunucu tarafı sayım/toplam ile hesaplanır. Önceden ilk 500 kayıt indirilip
// sayılıyordu; bu yüzden muhtaç sayısı 500'de takılı kalıyordu.
const beneficiaryCount = ref(0)
const criticalCount = ref(0)
const totalDelivered = ref(0)
const pendingApplicationCount = ref(0)
const aids = ref<Aid[]>([])
const inventory = ref<InventoryItem[]>([])
const newApplications = ref<Application[]>([])
const loading = ref(true)

const lowStock = computed(() => inventory.value.filter((i) => typeof i.lowStockThreshold === 'number' && i.quantity <= (i.lowStockThreshold ?? 0)))

onMounted(async () => {
  try {
    [
      beneficiaryCount.value, criticalCount.value, totalDelivered.value, pendingApplicationCount.value,
      aids.value, inventory.value, newApplications.value,
    ] = await Promise.all([
      countBeneficiaries(),
      countBeneficiaries('critical'),
      sumDeliveredAmount(),
      countApplications('new'),
      listAids(8),
      listInventory(),
      listApplications('new', 10),
    ])
  } finally { loading.value = false }
})
</script>

<template>
  <div class="dash">
    <div class="welcome">
      <div>
        <h2 class="welcome__title">Hoş geldiniz, {{ auth.profile?.fullName?.split(' ')[0] || '—' }}</h2>
        <p class="welcome__subtitle">Yardım kuruluşunuzun özet durumu.</p>
      </div>
      <div class="welcome__actions">
        <Button v-if="auth.can('beneficiaries','create')" icon="pi pi-user-plus" label="Yeni Muhtaç" outlined @click="router.push({ name: 'beneficiary-new' })" />
        <Button v-if="auth.can('aids','create')" icon="pi pi-heart-fill" label="Yeni Yardım" @click="router.push({ name: 'aid-new' })" />
      </div>
    </div>

    <div class="kpis">
      <Card class="kpi kpi--blue"><template #content>
        <div class="kpi__row">
          <div class="kpi__icon"><i class="pi pi-users" /></div>
          <div><div class="kpi__label">Muhtaç</div><div class="kpi__value">{{ beneficiaryCount }}</div></div>
        </div>
      </template></Card>
      <Card class="kpi kpi--red"><template #content>
        <div class="kpi__row">
          <div class="kpi__icon"><i class="pi pi-exclamation-triangle" /></div>
          <div><div class="kpi__label">Kritik Seviye</div><div class="kpi__value">{{ criticalCount }}</div></div>
        </div>
      </template></Card>
      <Card class="kpi kpi--green"><template #content>
        <div class="kpi__row">
          <div class="kpi__icon"><i class="pi pi-heart-fill" /></div>
          <div><div class="kpi__label">Toplam Nakdi Yardım</div><div class="kpi__value">{{ formatCurrency(totalDelivered) }}</div></div>
        </div>
      </template></Card>
      <Card class="kpi kpi--amber"><template #content>
        <div class="kpi__row">
          <div class="kpi__icon"><i class="pi pi-inbox" /></div>
          <div><div class="kpi__label">Bekleyen Başvuru</div><div class="kpi__value">{{ pendingApplicationCount }}</div></div>
        </div>
      </template></Card>
    </div>

    <div class="grid2">
      <Card>
        <template #title>
          <div class="card-head">
            <span><i class="pi pi-history" /> Son Yardımlar</span>
            <Button label="Tümü" size="small" text @click="router.push({ name: 'aids' })" />
          </div>
        </template>
        <template #content>
          <DataTable :value="aids" :loading="loading" size="small">
            <template #empty><div class="empty">Henüz yardım kaydı yok.</div></template>
            <Column header="Tarih"><template #body="{ data }">{{ formatDateTime(data.deliveredAt || data.createdAt) }}</template></Column>
            <Column field="beneficiaryName" header="Muhtaç" />
            <Column header="Tür"><template #body="{ data }">{{ AidTypeLabels[data.type as keyof typeof AidTypeLabels] }}</template></Column>
            <Column header="Miktar">
              <template #body="{ data }">
                <span v-if="data.amount">{{ formatCurrency(data.amount) }}</span>
                <span v-else>{{ data.items?.length || 0 }} kalem</span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Card>
        <template #title>
          <div class="card-head">
            <span><i class="pi pi-box" /> Düşük Stok Uyarıları</span>
            <Button label="Envanter" size="small" text @click="router.push({ name: 'inventory' })" />
          </div>
        </template>
        <template #content>
          <div v-if="!lowStock.length" class="empty">Tüm kalemler yeterli seviyede.</div>
          <ul v-else class="low-list">
            <li v-for="i in lowStock" :key="i.id">
              <div>
                <strong>{{ i.name }}</strong>
                <span class="muted"> · {{ i.location || 'Depo' }}</span>
              </div>
              <Tag severity="danger" :value="`${i.quantity} ${i.unit}`" />
            </li>
          </ul>
        </template>
      </Card>
    </div>

    <Card>
      <template #title>
        <div class="card-head">
          <span><i class="pi pi-inbox" /> Yeni Başvurular</span>
          <Button label="Başvurular" size="small" text @click="router.push({ name: 'applications' })" />
        </div>
      </template>
      <template #content>
        <DataTable :value="newApplications" size="small">
          <template #empty><div class="empty">Bekleyen başvuru yok.</div></template>
          <Column header="Tarih"><template #body="{ data }">{{ formatDateTime(data.createdAt) }}</template></Column>
          <Column field="fullName" header="Başvuran" />
          <Column field="phone" header="Telefon" />
          <Column field="city" header="Şehir" />
          <Column field="reason" header="Gerekçe">
            <template #body="{ data }"><span class="reason-cell">{{ data.reason }}</span></template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style lang="scss" scoped>
.dash { display: flex; flex-direction: column; gap: $spacing-xl; }

.welcome { display: flex; justify-content: space-between; align-items: flex-end; gap: $spacing-lg; flex-wrap: wrap;
  &__title { font-size: $font-size-2xl; font-weight: 700; color: $gray-900; margin: 0; }
  &__subtitle { color: $gray-500; margin-top: $spacing-xs; }
  &__actions { display: flex; gap: $spacing-sm; }
}

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: $spacing-md;
  @media (max-width: $breakpoint-md) { grid-template-columns: repeat(2, 1fr); }
}
.kpi__row { display: flex; align-items: center; gap: $spacing-md; }
.kpi__icon {
  width: 52px; height: 52px; border-radius: $radius-lg; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  i { font-size: 1.4rem; color: $white; }
}
.kpi__label { color: $gray-500; font-size: $font-size-sm; }
.kpi__value { font-size: $font-size-2xl; font-weight: 700; color: $gray-900; }
.kpi--blue .kpi__icon { background: linear-gradient(135deg, #0ea5e9, #3b82f6); }
.kpi--red .kpi__icon { background: linear-gradient(135deg, #ef4444, #f97316); }
.kpi--green .kpi__icon { background: linear-gradient(135deg, #22c55e, #10b981); }
.kpi--amber .kpi__icon { background: linear-gradient(135deg, #f59e0b, #ef4444); }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: $spacing-lg;
  @media (max-width: $breakpoint-lg) { grid-template-columns: 1fr; }
}
.card-head { display: flex; justify-content: space-between; align-items: center;
  i { margin-right: 6px; color: $gray-500; }
}
.low-list { list-style: none; padding: 0; margin: 0;
  li { display: flex; justify-content: space-between; align-items: center;
    padding: $spacing-sm 0; border-bottom: 1px solid $gray-100;
    &:last-child { border-bottom: none; }
  }
  .muted { color: $gray-500; font-size: $font-size-sm; }
}
.empty { text-align: center; padding: $spacing-lg; color: $gray-500; }
.reason-cell { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
