<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import {
  BACKUP_COLLECTIONS, BackupCollectionLabels, exportBackup, parseBackup, summarizeBackup,
  importBackup, downloadJson,
  type BackupCollection, type BackupFile, type ImportMode, type ImportResult,
} from '@/services/backup'
import { formatDateTime } from '@/utils/format'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import ProgressBar from 'primevue/progressbar'
import Message from 'primevue/message'

const toast = useToast()
const confirm = useConfirm()

// ---- Dışa aktarma ----
const exportSelection = ref<BackupCollection[]>([...BACKUP_COLLECTIONS])
const exporting = ref(false)
const exportLog = ref<{ name: BackupCollection; count: number }[]>([])

async function runExport() {
  exporting.value = true
  exportLog.value = []
  try {
    const data = await exportBackup(exportSelection.value, (name, count) => exportLog.value.push({ name, count }))
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
    downloadJson(data, `cansuyu-yedek-${stamp}.json`)
    const total = exportLog.value.reduce((s, x) => s + x.count, 0)
    toast.add({ severity: 'success', summary: 'Yedek indirildi', detail: `${total} kayıt dışa aktarıldı.`, life: 4000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Yedek alınamadı', detail: (e as Error).message, life: 6000 })
  } finally {
    exporting.value = false
  }
}

// ---- İçe aktarma ----
const fileInput = ref<HTMLInputElement>()
const file = ref<BackupFile | null>(null)
const fileName = ref('')
const fileError = ref('')
const importSelection = ref<BackupCollection[]>([])
const mode = ref<ImportMode>('skip-existing')
const importing = ref(false)
const progress = ref({ done: 0, total: 0 })
const importResult = ref<Record<string, ImportResult> | null>(null)

const summary = computed(() => (file.value ? summarizeBackup(file.value) : []))
const exportedAt = computed(() => {
  const meta = file.value?.meta as { exportedAt?: string } | undefined
  return meta?.exportedAt ? formatDateTime(meta.exportedAt) : null
})
const progressPercent = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = '' // aynı dosya tekrar seçilebilsin
  file.value = null
  fileError.value = ''
  importResult.value = null
  if (!f) return
  fileName.value = f.name
  try {
    file.value = parseBackup(await f.text())
    // Kullanıcılar varsayılan olarak seçilmez: yetkileri / rolleri değiştirebilir
    importSelection.value = summary.value.map((s) => s.name).filter((n) => n !== 'users')
  } catch (err) {
    fileError.value = (err as Error).message
  }
}

function askImport() {
  const total = summary.value
    .filter((s) => importSelection.value.includes(s.name))
    .reduce((s, x) => s + x.count, 0)
  confirm.require({
    header: 'Yedeği geri yükle',
    message: mode.value === 'overwrite'
      ? `${total} kayıt yüklenecek. Aynı kimliğe sahip mevcut kayıtların ÜZERİNE YAZILACAK. Devam edilsin mi?`
      : `${total} kayıt incelenecek; yalnızca veritabanında olmayanlar eklenecek. Devam edilsin mi?`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Yükle', rejectLabel: 'Vazgeç',
    acceptClass: mode.value === 'overwrite' ? 'p-button-danger' : undefined,
    accept: runImport,
  })
}

async function runImport() {
  if (!file.value) return
  importing.value = true
  importResult.value = null
  progress.value = { done: 0, total: 0 }
  try {
    importResult.value = await importBackup(file.value, importSelection.value, mode.value, (done, total) => {
      progress.value = { done, total }
    })
    const written = Object.values(importResult.value).reduce((s, r) => s + r.written, 0)
    toast.add({ severity: 'success', summary: 'Geri yükleme tamamlandı', detail: `${written} kayıt yazıldı.`, life: 4000 })
  } catch (e) {
    const code = (e as { code?: string }).code
    const detail = code === 'permission-denied'
      ? 'Bu işlem için yetkiniz yok.'
      : `${(e as Error).message} — ${progress.value.done} kayıt yazılmıştı; tekrar denerseniz "yalnızca yenileri ekle" ile kaldığı yerden devam eder.`
    toast.add({ severity: 'error', summary: 'Geri yükleme yarıda kaldı', detail, life: 8000 })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">Yedekleme</h2>
        <p class="page__subtitle">Verilerin yedeğini JSON dosyası olarak indirin veya bir yedeği geri yükleyin.</p>
      </div>
    </div>

    <div class="grid2">
      <!-- Dışa aktar -->
      <section class="card">
        <h3 class="card__title"><i class="pi pi-download" /> Yedek Al (Dışa Aktar)</h3>
        <p class="muted">Seçili koleksiyonların tüm kayıtları tek bir dosyaya indirilir.</p>

        <div class="checks">
          <label v-for="c in BACKUP_COLLECTIONS" :key="c" class="check">
            <Checkbox v-model="exportSelection" :value="c" :disabled="exporting" />
            <span>{{ BackupCollectionLabels[c] }}</span>
            <span v-if="exportLog.find((x) => x.name === c)" class="count">
              {{ exportLog.find((x) => x.name === c)?.count }} kayıt
            </span>
          </label>
        </div>

        <Button
          label="Yedeği İndir" icon="pi pi-download" :loading="exporting"
          :disabled="!exportSelection.length" @click="runExport"
        />
      </section>

      <!-- İçe aktar -->
      <section class="card">
        <h3 class="card__title"><i class="pi pi-upload" /> Yedekten Geri Yükle (İçe Aktar)</h3>
        <p class="muted">Bu panelden alınmış bir yedek dosyasını (.json) seçin.</p>

        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChange" />
        <Button
          label="Dosya Seç" icon="pi pi-folder-open" severity="secondary" outlined
          :disabled="importing" @click="fileInput?.click()"
        />

        <Message v-if="fileError" severity="error" :closable="false">{{ fileError }}</Message>

        <template v-if="file">
          <div class="file-info">
            <i class="pi pi-file" /> <strong>{{ fileName }}</strong>
            <span v-if="exportedAt" class="muted"> · {{ exportedAt }} tarihli yedek</span>
          </div>

          <div class="checks">
            <label v-for="s in summary" :key="s.name" class="check">
              <Checkbox v-model="importSelection" :value="s.name" :disabled="importing" />
              <span>{{ BackupCollectionLabels[s.name] }}</span>
              <span class="count">{{ s.count }} kayıt</span>
              <span v-if="importResult?.[s.name]" class="result">
                ✓ {{ importResult[s.name]!.written }} yazıldı<template v-if="importResult[s.name]!.skipped">, {{ importResult[s.name]!.skipped }} zaten vardı</template>
              </span>
            </label>
          </div>
          <Message v-if="importSelection.includes('users')" severity="warn" :closable="false">
            Kullanıcılar geri yüklenirse rol ve yetkiler yedekteki haline döner.
          </Message>

          <div class="modes">
            <label class="check">
              <RadioButton v-model="mode" value="skip-existing" :disabled="importing" />
              <span><strong>Yalnızca eksikleri ekle</strong> — mevcut kayıtlara dokunulmaz (önerilen)</span>
            </label>
            <label class="check">
              <RadioButton v-model="mode" value="overwrite" :disabled="importing" />
              <span><strong>Üzerine yaz</strong> — aynı kimlikli kayıtlar yedekteki haliyle değiştirilir</span>
            </label>
          </div>

          <div v-if="importing || progress.total" class="progress">
            <ProgressBar :value="progressPercent" />
            <small class="muted">{{ progress.done }} / {{ progress.total }} kayıt</small>
          </div>

          <Button
            label="Geri Yükle" icon="pi pi-upload" :loading="importing"
            :severity="mode === 'overwrite' ? 'danger' : undefined"
            :disabled="!importSelection.length" @click="askImport"
          />
        </template>
      </section>
    </div>

    <Message severity="info" :closable="false">
      Dosya, <code>node-firestore-import-export</code> aracının biçimindedir; tarih gibi Firestore tipleri korunur.
      Gerekirse komut satırından da yüklenebilir:<br />
      <code>npx -p node-firestore-import-export firestore-import -a servis-hesabi.json -b yedek.json</code>
    </Message>
  </div>
</template>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page__title { font-size: $font-size-2xl; font-weight: 700; color: $gray-900; margin: 0; }
.page__subtitle { color: $gray-500; margin-top: $spacing-xs; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: $spacing-lg; align-items: start;
  @media (max-width: $breakpoint-lg) { grid-template-columns: 1fr; }
}
.card { background: $white; border-radius: $radius-lg; padding: $spacing-xl; box-shadow: $shadow-sm; border: 1px solid $gray-200;
  display: flex; flex-direction: column; gap: $spacing-md; align-items: flex-start;
  > .p-message, > .checks, > .modes, > .progress { align-self: stretch; }
}
.card__title { font-size: $font-size-lg; font-weight: 600; color: $gray-900; margin: 0;
  i { margin-right: 6px; color: $gray-500; }
}
.muted { color: $gray-500; margin: 0; font-size: $font-size-sm; }
.checks, .modes { display: flex; flex-direction: column; gap: $spacing-sm; }
.check { display: flex; align-items: center; gap: $spacing-sm; color: $gray-700; cursor: pointer; flex-wrap: wrap; }
.count { color: $gray-500; font-size: $font-size-sm; }
.result { color: #16a34a; font-size: $font-size-sm; }
.file-info { color: $gray-700; i { color: $gray-500; } }
.progress { display: flex; flex-direction: column; gap: $spacing-xs; }
code { font-size: 0.85em; background: rgba(0, 0, 0, 0.05); padding: 1px 4px; border-radius: 4px; word-break: break-all; }
@media (max-width: $breakpoint-md) { .card { padding: $spacing-md; } }
</style>
