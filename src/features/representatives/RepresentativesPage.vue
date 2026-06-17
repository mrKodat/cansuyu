<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { listRepresentatives, upsertRepresentative, updateRepresentative, deleteRepresentative } from '@/services/representatives'
import type { Representative, Role } from '@/types'
import { RoleLabels } from '@/types'
import { formatDateTime } from '@/utils/format'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const toast = useToast()
const confirm = useConfirm()

const items = ref<Representative[]>([])
const loading = ref(false)

const roleOptions = Object.entries(RoleLabels).map(([value, label]) => ({ label, value }))

const dialog = ref(false)
const editing = ref<Partial<Representative>>({})
const saving = ref(false)

async function refresh() {
  loading.value = true
  try { items.value = await listRepresentatives() } finally { loading.value = false }
}

function openNew() {
  editing.value = { uid: '', email: '', fullName: '', role: 'representative', active: true }
  dialog.value = true
}
function openEdit(r: Representative) {
  editing.value = { ...r }
  dialog.value = true
}

async function save() {
  if (!editing.value.uid?.trim() || !editing.value.email?.trim() || !editing.value.fullName?.trim()) return
  saving.value = true
  try {
    const r = editing.value
    if (items.value.find((x) => x.id === r.id)) {
      await updateRepresentative(r.id!, {
        email: r.email!, fullName: r.fullName!, phone: r.phone,
        role: r.role as Role, branch: r.branch, active: r.active ?? true,
      } as Partial<Representative>)
    } else {
      await upsertRepresentative({
        uid: r.uid!, email: r.email!, fullName: r.fullName!, phone: r.phone,
        role: r.role as Role, branch: r.branch, active: r.active ?? true,
      })
    }
    toast.add({ severity: 'success', summary: 'Kaydedildi', life: 2500 })
    dialog.value = false
    refresh()
  } finally { saving.value = false }
}

function confirmDel(r: Representative) {
  confirm.require({
    message: `"${r.fullName}" profili silinsin mi? (Firebase Auth hesabı ayrıca silinmelidir.)`,
    header: 'Silme Onayı', icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sil', rejectLabel: 'Vazgeç', acceptClass: 'p-button-danger',
    accept: async () => { await deleteRepresentative(r.id); refresh() },
  })
}

function roleSeverity(r: Role) {
  return r === 'admin' ? 'danger' : r === 'manager' ? 'warn' : r === 'representative' ? 'info' : 'secondary'
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Temsilciler</h2>
        <p class="page__subtitle">Panel kullanıcıları ve rolleri.</p>
      </div>
      <Button label="Yeni Temsilci" icon="pi pi-plus" @click="openNew" />
    </div>

    <Message severity="info" :closable="false">
      <strong>Not:</strong> Temsilci ekleme işlemi Firebase Authentication üzerinden de gerçekleştirilmelidir.
      Önce Firebase Console'da kullanıcıyı oluşturun, ardından buradaki UID alanına Firebase UID'yi girerek profili bağlayın.
    </Message>

    <div class="card">
      <DataTable :value="items" :loading="loading" :rows="25" paginator striped-rows row-hover>
        <template #empty><div class="empty">Temsilci bulunamadı.</div></template>
        <Column field="fullName" header="Ad Soyad" sortable />
        <Column field="email" header="E-posta" />
        <Column field="phone" header="Telefon" />
        <Column header="Rol">
          <template #body="{ data }">
            <Tag :severity="roleSeverity(data.role as Role)" :value="RoleLabels[data.role as Role]" />
          </template>
        </Column>
        <Column field="branch" header="Şube" />
        <Column header="Durum">
          <template #body="{ data }">
            <Tag :severity="data.active ? 'success' : 'secondary'" :value="data.active ? 'Aktif' : 'Pasif'" />
          </template>
        </Column>
        <Column header="Son Giriş">
          <template #body="{ data }">{{ formatDateTime(data.lastLoginAt) }}</template>
        </Column>
        <Column header="" style="width:6rem">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDel(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialog" modal :header="editing.id ? 'Temsilci Düzenle' : 'Yeni Temsilci'" style="width: 540px">
      <div class="form">
        <div class="field"><label>Firebase UID *</label>
          <InputText v-model="editing.uid" :disabled="!!editing.id" fluid />
        </div>
        <div class="field"><label>Ad Soyad *</label><InputText v-model="editing.fullName" fluid /></div>
        <div class="field"><label>E-posta *</label><InputText v-model="editing.email" fluid /></div>
        <div class="field"><label>Telefon</label><InputText v-model="editing.phone" fluid /></div>
        <div class="row">
          <div class="field"><label>Rol</label>
            <Select v-model="editing.role" :options="roleOptions" option-label="label" option-value="value" fluid />
          </div>
          <div class="field"><label>Şube</label><InputText v-model="editing.branch" fluid /></div>
        </div>
        <div class="field field--row">
          <label>Aktif</label>
          <ToggleSwitch v-model="editing.active" />
        </div>
      </div>
      <template #footer>
        <Button label="İptal" severity="secondary" text @click="dialog = false" />
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
  &--row { flex-direction: row; align-items: center; gap: $spacing-md; }
}
</style>
