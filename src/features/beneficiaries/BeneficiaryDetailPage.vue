<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { getBeneficiary, deleteBeneficiary } from '@/services/beneficiaries'
import { listAidsByBeneficiary } from '@/services/aids'
import type { Beneficiary, Aid, NeedLevel, AppliancePresence } from '@/types'
import { NeedLevelLabels, AidTypeLabels, AidStatusLabels, AppliancePresenceLabels } from '@/types'
import { formatDate, formatDateTime, formatCurrency, formatPhone } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Card from 'primevue/card'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const auth = useAuthStore()

const id = route.params.id as string
const beneficiary = ref<Beneficiary | null>(null)
const aids = ref<Aid[]>([])
const loading = ref(true)

const totalReceived = computed(() => aids.value
  .filter((a) => a.status === 'delivered')
  .reduce((sum, a) => sum + (a.amount ?? 0), 0))

const totalIncome = computed(() => (beneficiary.value?.incomes ?? []).reduce((s, i) => s + (i.monthlyAmount || 0), 0)
  + (beneficiary.value?.governmentBenefits ?? []).reduce((s, g) => s + (g.monthlyAmount || 0), 0))

const housingLabel: Record<string, string> = {
  owner: 'Ev sahibi', tenant: 'Kiracı', relative: 'Akraba/tanıdık yanında', other: 'Diğer',
}

const applianceSeverity = (s: AppliancePresence) =>
  s === 'have' ? 'success' : s === 'broken' ? 'warn' : 'danger'

function flagList(fm: { isStudent?: boolean; isDisabled?: boolean; isWorking?: boolean; hasInsurance?: boolean }): string {
  const flags: string[] = []
  if (fm.isStudent) flags.push('Öğrenci')
  if (fm.isWorking) flags.push('Çalışıyor')
  if (fm.isDisabled) flags.push('Engelli')
  if (fm.hasInsurance) flags.push('Sigortalı')
  return flags.join(' · ') || '—'
}

const needSeverity = (n?: NeedLevel) =>
  n === 'critical' ? 'danger' : n === 'high' ? 'warn' : n === 'medium' ? 'info' : 'secondary'

const aidStatusSeverity = (s: string) =>
  s === 'delivered' ? 'success' : s === 'approved' ? 'info' : s === 'pending' ? 'warn' : 'danger'

onMounted(async () => {
  try {
    beneficiary.value = await getBeneficiary(id)
    aids.value = await listAidsByBeneficiary(id)
  } finally {
    loading.value = false
  }
})

function confirmDelete() {
  confirm.require({
    message: 'Bu muhtaç kaydını silmek istediğinize emin misiniz? Yardım kayıtları korunur.',
    header: 'Silme Onayı', icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sil', rejectLabel: 'Vazgeç', acceptClass: 'p-button-danger',
    accept: async () => {
      await deleteBeneficiary(id)
      toast.add({ severity: 'success', summary: 'Silindi', life: 3000 })
      router.push({ name: 'beneficiaries' })
    },
  })
}
</script>

<template>
  <div v-if="loading" class="loading">Yükleniyor…</div>
  <div v-else-if="!beneficiary" class="loading">Kayıt bulunamadı.</div>
  <div v-else class="page">
    <div class="page__header">
      <div class="identity">
        <div class="avatar">{{ beneficiary.fullName.charAt(0).toUpperCase() }}</div>
        <div>
          <h2 class="name">{{ beneficiary.fullName }}</h2>
          <div class="meta">
            <span><i class="pi pi-id-card" /> {{ beneficiary.nationalId }}</span>
            <span><i class="pi pi-phone" /> {{ formatPhone(beneficiary.phone) }}</span>
            <Tag :severity="needSeverity(beneficiary.needLevel)" :value="`Muhtaçlık: ${NeedLevelLabels[beneficiary.needLevel]}`" />
          </div>
        </div>
      </div>
      <div class="actions">
        <Button
          v-if="auth.can('beneficiaries', 'update')"
          label="Düzenle" icon="pi pi-pencil" outlined
          @click="router.push({ name: 'beneficiary-edit', params: { id } })"
        />
        <Button
          v-if="auth.can('aids', 'create')"
          label="Yardım Ekle" icon="pi pi-plus" severity="primary"
          @click="router.push({ name: 'aid-new', query: { beneficiaryId: id } })"
        />
        <Button
          v-if="auth.can('beneficiaries', 'delete')"
          icon="pi pi-trash" severity="danger" outlined @click="confirmDelete"
        />
      </div>
    </div>

    <div class="stats">
      <Card class="stat">
        <template #content>
          <div class="stat__label">Aylık Toplam Gelir</div>
          <div class="stat__value">{{ formatCurrency(totalIncome) }}</div>
        </template>
      </Card>
      <Card class="stat">
        <template #content>
          <div class="stat__label">Alınan Toplam Yardım</div>
          <div class="stat__value">{{ formatCurrency(totalReceived) }}</div>
        </template>
      </Card>
      <Card class="stat">
        <template #content>
          <div class="stat__label">Yardım Sayısı</div>
          <div class="stat__value">{{ aids.length }}</div>
        </template>
      </Card>
      <Card class="stat">
        <template #content>
          <div class="stat__label">Bakmakla Yükümlü</div>
          <div class="stat__value">{{ beneficiary.dependentCount ?? 0 }} kişi</div>
        </template>
      </Card>
      <Card class="stat">
        <template #content>
          <div class="stat__label">Aylık Kira</div>
          <div class="stat__value">{{ formatCurrency(beneficiary.monthlyRent) }}</div>
        </template>
      </Card>
    </div>

    <div class="cols">
      <div class="col">
        <Card>
          <template #title>İletişim & Adres</template>
          <template #content>
            <dl class="kv">
              <dt>Telefon</dt><dd>{{ formatPhone(beneficiary.phone) }}</dd>
              <dt>Alt. Telefon</dt><dd>{{ formatPhone(beneficiary.phoneAlt) }}</dd>
              <dt>E-posta</dt><dd>{{ beneficiary.email || '—' }}</dd>
              <dt>Doğum Tarihi</dt><dd>{{ formatDate(beneficiary.birthDate) }}</dd>
              <dt>Medeni Durum</dt><dd>{{ beneficiary.maritalStatus || '—' }}</dd>
              <dt>Şehir / İlçe</dt><dd>{{ beneficiary.address?.city || '—' }} / {{ beneficiary.address?.district || '—' }}</dd>
              <dt>Mahalle</dt><dd>{{ beneficiary.address?.neighborhood || '—' }}</dd>
              <dt>Açık Adres</dt><dd>{{ beneficiary.address?.fullAddress || '—' }}</dd>
            </dl>
          </template>
        </Card>

        <Card v-if="beneficiary.needNotes">
          <template #title>Durum Notları</template>
          <template #content><p class="notes">{{ beneficiary.needNotes }}</p></template>
        </Card>

        <Card>
          <template #title>Aile Bireyleri ({{ beneficiary.familyMembers.length }})</template>
          <template #content>
            <div v-if="!beneficiary.familyMembers.length" class="muted">Aile bireyi kaydı yok.</div>
            <DataTable v-else :value="beneficiary.familyMembers" striped-rows size="small">
              <Column field="fullName" header="Ad Soyad" />
              <Column field="relation" header="Yakınlık" />
              <Column header="Yaş">
                <template #body="{ data }">{{ data.age ?? (data.birthYear ? new Date().getFullYear() - data.birthYear : '—') }}</template>
              </Column>
              <Column header="Cins.">
                <template #body="{ data }">{{ data.gender === 'male' ? 'E' : data.gender === 'female' ? 'K' : '—' }}</template>
              </Column>
              <Column header="Beden">
                <template #body="{ data }">
                  <span v-if="data.clothingSize || data.shoeSize">
                    {{ data.clothingSize || '—' }}<span v-if="data.shoeSize"> · {{ data.shoeSize }}</span>
                  </span>
                  <span v-else>—</span>
                </template>
              </Column>
              <Column header="Durum">
                <template #body="{ data }">{{ flagList(data) }}</template>
              </Column>
              <Column header="Meslek / Not">
                <template #body="{ data }">
                  <span>{{ data.occupation || data.disabilityNote || data.chronicIllness || data.note || '—' }}</span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>Konut & Kira</template>
          <template #content>
            <dl class="kv">
              <dt>Konut Durumu</dt><dd>{{ beneficiary.housingStatus ? housingLabel[beneficiary.housingStatus] : '—' }}</dd>
              <dt>Aylık Kira</dt><dd>{{ formatCurrency(beneficiary.monthlyRent) }}</dd>
              <dt>Not</dt><dd>{{ beneficiary.rentNote || '—' }}</dd>
            </dl>
          </template>
        </Card>
      </div>

      <div class="col">
        <Card>
          <template #title>Gelirler</template>
          <template #content>
            <div v-if="!beneficiary.incomes.length" class="muted">Gelir kaydı yok.</div>
            <DataTable v-else :value="beneficiary.incomes" striped-rows>
              <Column field="type" header="Tür" />
              <Column header="Aylık">
                <template #body="{ data }">{{ formatCurrency(data.monthlyAmount) }}</template>
              </Column>
              <Column field="note" header="Not" />
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>Devlet Destekleri</template>
          <template #content>
            <div v-if="!beneficiary.governmentBenefits.length" class="muted">Devlet desteği kaydı yok.</div>
            <DataTable v-else :value="beneficiary.governmentBenefits" striped-rows>
              <Column field="program" header="Program" />
              <Column header="Aylık">
                <template #body="{ data }">{{ formatCurrency(data.monthlyAmount) }}</template>
              </Column>
              <Column field="since" header="Başlangıç" />
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>Diğer Kuruluş Kayıtları</template>
          <template #content>
            <div v-if="!beneficiary.externalAidRecords.length" class="muted">Başka kuruluş kaydı yok.</div>
            <DataTable v-else :value="beneficiary.externalAidRecords" striped-rows>
              <Column field="organization" header="Kuruluş" />
              <Column field="type" header="Tür" />
              <Column field="note" header="Not" />
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>Evdeki Eşya Durumu</template>
          <template #content>
            <div v-if="!beneficiary.householdAppliances?.length" class="muted">Eşya bilgisi girilmemiş.</div>
            <div v-else class="appliance-grid">
              <div v-for="(ap, i) in beneficiary.householdAppliances" :key="i" class="appliance-card">
                <div class="appliance-card__name">{{ ap.name }}</div>
                <Tag :severity="applianceSeverity(ap.status as AppliancePresence)" :value="AppliancePresenceLabels[ap.status as AppliancePresence]" />
                <div v-if="ap.note" class="appliance-card__note">{{ ap.note }}</div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <Divider />

    <Card class="aid-history">
      <template #title>
        <div class="aid-history__title">
          <span><i class="pi pi-history" /> Yardım Geçmişi ({{ aids.length }})</span>
          <Button
            v-if="auth.can('aids', 'create')"
            label="Yeni Yardım" icon="pi pi-plus" size="small"
            @click="router.push({ name: 'aid-new', query: { beneficiaryId: id } })"
          />
        </div>
      </template>
      <template #content>
        <DataTable
          :value="aids" :rows="20" paginator striped-rows data-key="id"
          class="cursor-table"
          @row-click="(e) => router.push({ name: 'aid-detail', params: { id: (e.data as Aid).id } })"
        >
          <template #empty><div class="muted">Bu muhtaç için henüz yardım kaydı yok.</div></template>
          <Column header="Tarih" sortable>
            <template #body="{ data }">{{ formatDateTime(data.deliveredAt || data.createdAt) }}</template>
          </Column>
          <Column header="Tür">
            <template #body="{ data }">{{ AidTypeLabels[data.type as keyof typeof AidTypeLabels] }}</template>
          </Column>
          <Column header="Miktar / Kalem">
            <template #body="{ data }">
              <span v-if="data.amount">{{ formatCurrency(data.amount) }}</span>
              <span v-else-if="data.items?.length">{{ data.items.length }} kalem</span>
              <span v-else>—</span>
            </template>
          </Column>
          <Column header="Durum">
            <template #body="{ data }">
              <Tag :severity="aidStatusSeverity(data.status)" :value="AidStatusLabels[data.status as keyof typeof AidStatusLabels]" />
            </template>
          </Column>
          <Column header="Bağışçı">
            <template #body="{ data }">{{ data.donorName || '—' }}</template>
          </Column>
          <Column field="deliveredByName" header="Teslim Eden" />
          <Column header="" style="width:3rem">
            <template #body><i class="pi pi-arrow-right" style="color: #9ca3af" /></template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style lang="scss" scoped>
.loading { padding: $spacing-2xl; text-align: center; color: $gray-500; }
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: $spacing-md; }
.identity { display: flex; align-items: center; gap: $spacing-md; }
.avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  color: $white; font-size: 1.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.name { margin: 0; font-size: $font-size-2xl; font-weight: 700; color: $gray-900; }
.meta { display: flex; gap: $spacing-md; align-items: center; margin-top: $spacing-xs; color: $gray-600; flex-wrap: wrap;
  i { margin-right: 4px; }
}
.actions { display: flex; gap: $spacing-sm; }

.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: $spacing-md;
  @media (max-width: $breakpoint-lg) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: $breakpoint-md) { grid-template-columns: repeat(2, 1fr); }
}
.stat__label { color: $gray-500; font-size: $font-size-sm; }
.stat__value { font-size: $font-size-xl; font-weight: 700; margin-top: $spacing-xs; color: $gray-900; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: $spacing-lg;
  @media (max-width: $breakpoint-lg) { grid-template-columns: 1fr; }
}
.col { display: flex; flex-direction: column; gap: $spacing-md; }
.kv { display: grid; grid-template-columns: 140px 1fr; gap: $spacing-xs $spacing-md; margin: 0;
  dt { color: $gray-500; font-size: $font-size-sm; }
  dd { margin: 0; color: $gray-900; }
}
.muted { color: $gray-500; font-style: italic; padding: $spacing-md 0; }
.notes { color: $gray-700; line-height: 1.6; white-space: pre-wrap; margin: 0; }
.aid-history__title { display: flex; justify-content: space-between; align-items: center; }

.appliance-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: $spacing-sm;
}
.appliance-card {
  padding: $spacing-sm $spacing-md; border: 1px solid $gray-200;
  border-radius: $radius-md; background: $gray-50;
  display: flex; flex-direction: column; gap: $spacing-xs;
  &__name { font-weight: 600; color: $gray-800; font-size: $font-size-sm; }
  &__note { font-size: $font-size-sm; color: $gray-500; }
}
</style>
