<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAid, deleteAid } from '@/services/aids'
import type { Aid, AidType, AidStatus } from '@/types'
import { AidTypeLabels, AidStatusLabels } from '@/types'
import { formatDateTime, formatCurrency } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const id = route.params.id as string
const aid = ref<Aid | null>(null)
const loading = ref(true)

const statusSeverity = (s?: AidStatus) =>
  s === 'delivered' ? 'success' : s === 'approved' ? 'info' : s === 'pending' ? 'warn' : 'danger'

const itemsTotal = (a: Aid) =>
  (a.items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitCost ?? 0), 0)

onMounted(async () => {
  try {
    aid.value = await getAid(id)
  } finally { loading.value = false }
})

function confirmDelete() {
  if (!aid.value) return
  confirm.require({
    message: 'Bu yardım kaydı silinsin mi?', header: 'Silme Onayı',
    icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sil', rejectLabel: 'Vazgeç',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await deleteAid(id)
      toast.add({ severity: 'success', summary: 'Silindi', life: 2500 })
      router.push({ name: 'aids' })
    },
  })
}
</script>

<template>
  <div v-if="loading" class="loading">Yükleniyor…</div>
  <div v-else-if="!aid" class="loading">Yardım kaydı bulunamadı.</div>
  <div v-else class="page">
    <div class="page__header">
      <div class="identity">
        <div class="icon" :class="`icon--${aid.type}`">
          <i class="pi" :class="aid.type === 'cash' ? 'pi-wallet' : 'pi-box'" />
        </div>
        <div>
          <div class="eyebrow">{{ AidTypeLabels[aid.type as AidType] }} Yardımı</div>
          <h2 class="name">
            <a @click="router.push({ name: 'beneficiary-detail', params: { id: aid.beneficiaryId } })" class="link">
              {{ aid.beneficiaryName }}
            </a>
          </h2>
          <div class="meta">
            <Tag :severity="statusSeverity(aid.status as AidStatus)" :value="AidStatusLabels[aid.status as AidStatus]" />
            <span><i class="pi pi-calendar" /> {{ formatDateTime(aid.deliveredAt || aid.createdAt) }}</span>
          </div>
        </div>
      </div>
      <div class="actions">
        <Button
          v-if="auth.can('aids','delete')"
          icon="pi pi-trash" severity="danger" outlined @click="confirmDelete"
        />
      </div>
    </div>

    <div class="grid2">
      <Card>
        <template #title>Yardım Bilgileri</template>
        <template #content>
          <dl class="kv">
            <dt>Tür</dt><dd>{{ AidTypeLabels[aid.type as AidType] }}</dd>
            <dt>Durum</dt><dd><Tag :severity="statusSeverity(aid.status as AidStatus)" :value="AidStatusLabels[aid.status as AidStatus]" /></dd>
            <template v-if="aid.type === 'cash'">
              <dt>Tutar</dt><dd class="strong">{{ formatCurrency(aid.amount) }}</dd>
              <dt>Para Birimi</dt><dd>{{ aid.currency || 'TRY' }}</dd>
            </template>
            <template v-else>
              <dt>Kalem Sayısı</dt><dd>{{ aid.items?.length ?? 0 }}</dd>
              <dt>Tahmini Değer</dt><dd>{{ itemsTotal(aid) > 0 ? formatCurrency(itemsTotal(aid)) : '—' }}</dd>
            </template>
            <dt>Teslim Tarihi</dt><dd>{{ formatDateTime(aid.deliveredAt) }}</dd>
            <dt>Kayıt Tarihi</dt><dd>{{ formatDateTime(aid.createdAt) }}</dd>
            <dt>Son Güncelleme</dt><dd>{{ formatDateTime(aid.updatedAt) }}</dd>
          </dl>
        </template>
      </Card>

      <Card>
        <template #title>Taraflar</template>
        <template #content>
          <dl class="kv">
            <dt>Muhtaç</dt>
            <dd>
              <a @click="router.push({ name: 'beneficiary-detail', params: { id: aid.beneficiaryId } })" class="link">
                {{ aid.beneficiaryName }}
              </a>
            </dd>
            <dt>Bağışçı</dt>
            <dd>
              <a v-if="aid.donorId" @click="router.push({ name: 'donors' })" class="link">
                {{ aid.donorName || '—' }}
              </a>
              <span v-else-if="aid.donorName">{{ aid.donorName }} <span class="muted">(manuel)</span></span>
              <span v-else class="muted">Belirtilmemiş</span>
            </dd>
            <dt>Teslim Eden</dt><dd>{{ aid.deliveredByName || '—' }}</dd>
          </dl>
        </template>
      </Card>
    </div>

    <Card v-if="aid.items?.length">
      <template #title>Kalemler</template>
      <template #content>
        <DataTable :value="aid.items" striped-rows>
          <Column field="name" header="Ad" />
          <Column header="Miktar">
            <template #body="{ data }">{{ data.quantity }} {{ data.unit }}</template>
          </Column>
          <Column header="Birim Maliyet">
            <template #body="{ data }">{{ formatCurrency(data.unitCost) }}</template>
          </Column>
          <Column header="Toplam">
            <template #body="{ data }">{{ formatCurrency((data.quantity ?? 0) * (data.unitCost ?? 0)) }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card v-if="aid.note">
      <template #title>Not</template>
      <template #content><p class="notes">{{ aid.note }}</p></template>
    </Card>
  </div>
</template>

<style lang="scss" scoped>
.loading { padding: $spacing-2xl; text-align: center; color: $gray-500; }
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: $spacing-md; }
.identity { display: flex; align-items: center; gap: $spacing-md; }
.icon {
  width: 64px; height: 64px; border-radius: $radius-xl;
  display: flex; align-items: center; justify-content: center;
  i { font-size: 1.75rem; color: $white; }
  &--cash { background: linear-gradient(135deg, #10b981, #22c55e); }
  &--food, &--clothing, &--fuel, &--medical, &--education, &--other {
    background: linear-gradient(135deg, #6366f1, #0ea5e9);
  }
}
.eyebrow { color: $gray-500; font-size: $font-size-sm; text-transform: uppercase; letter-spacing: 0.5px; }
.name { margin: 2px 0 $spacing-xs; font-size: $font-size-2xl; font-weight: 700; color: $gray-900; }
.meta { display: flex; gap: $spacing-md; align-items: center; color: $gray-600; flex-wrap: wrap;
  i { margin-right: 4px; }
}
.actions { display: flex; gap: $spacing-sm; }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: $spacing-lg;
  @media (max-width: $breakpoint-lg) { grid-template-columns: 1fr; }
}
.kv { display: grid; grid-template-columns: 160px 1fr; gap: $spacing-xs $spacing-md; margin: 0;
  dt { color: $gray-500; font-size: $font-size-sm; }
  dd { margin: 0; color: $gray-900; }
  .strong { font-weight: 700; font-size: $font-size-lg; }
  .muted { color: $gray-500; font-size: $font-size-sm; }
}
.link { color: #6366f1; cursor: pointer; text-decoration: none; &:hover { text-decoration: underline; } }
.notes { margin: 0; white-space: pre-wrap; line-height: 1.6; color: $gray-700; }
</style>
