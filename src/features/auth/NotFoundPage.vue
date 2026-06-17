<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
const router = useRouter()
</script>

<template>
  <div class="not-found">
    <div class="not-found__content">
      <h1>404</h1>
      <h2>Sayfa bulunamadı</h2>
      <p>Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
      <Button label="Ana sayfaya dön" icon="pi pi-home" @click="router.push('/')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.not-found { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: $gray-50;
  &__content { text-align: center; padding: $spacing-xl;
    h1 { font-size: 6rem; font-weight: 800; color: $gray-300; line-height: 1; margin-bottom: $spacing-md; }
    h2 { font-size: $font-size-2xl; color: $gray-900; margin-bottom: $spacing-sm; }
    p { color: $gray-500; margin-bottom: $spacing-xl; }
  }
}
</style>
