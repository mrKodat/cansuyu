<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Can Suyu Yardım'
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')

async function submit() {
  const ok = await auth.login(email.value.trim(), password.value)
  if (ok) {
    const redirect = (route.query.redirect as string) || '/'
    const safe = redirect.startsWith('/') && !redirect.startsWith('//')
    router.push(safe ? redirect : '/')
  }
}
</script>

<template>
  <div class="login">
    <aside class="login__brand">
      <div class="login__brand-content">
        <div class="login__logo"><i class="pi pi-heart-fill" /></div>
        <h1>{{ APP_NAME }}</h1>
        <p>Yardım kuruluşu yönetim paneli — muhtaçlar, bağışçılar, yardımlar ve envanter tek çatı altında.</p>
      </div>
      <div class="login__brand-footer">
        &copy; {{ new Date().getFullYear() }} {{ APP_NAME }}
      </div>
    </aside>

    <div class="login__form-container">
      <div class="login__card">
        <header class="login__header">
          <h2>Hoş geldiniz</h2>
          <p>Hesabınızla oturum açın</p>
        </header>

        <form class="login__form" @submit.prevent="submit">
          <Message v-if="auth.error" severity="error" :closable="false" class="login__error">
            {{ auth.error }}
          </Message>

          <div class="form-group">
            <label for="email">E-posta</label>
            <InputText id="email" v-model="email" type="email" placeholder="ornek@kurum.org" fluid autocomplete="email" required />
          </div>

          <div class="form-group">
            <label for="password">Şifre</label>
            <Password id="password" v-model="password" :feedback="false" toggle-mask placeholder="Şifreniz" fluid autocomplete="current-password" required />
          </div>

          <Button type="submit" label="Giriş Yap" :loading="auth.loading" class="login__submit w-full" icon="pi pi-sign-in" icon-pos="right" />
        </form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login { display: flex; min-height: 100vh; }

.login__brand {
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 45%;
  padding: $spacing-2xl;
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  color: $white;
  position: relative;
  overflow: hidden;

  @media (min-width: $breakpoint-lg) { display: flex; }

  &::before, &::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,0.1); }
  &::before { width: 300px; height: 300px; top: -100px; right: -100px; }
  &::after { width: 220px; height: 220px; bottom: -60px; left: -60px; }
}
.login__brand-content { position: relative; z-index: 1; margin: auto 0; }
.login__brand-content h1 { font-size: $font-size-3xl; font-weight: 700; margin-bottom: $spacing-md; }
.login__brand-content p { font-size: $font-size-lg; opacity: 0.9; max-width: 340px; line-height: 1.6; }
.login__brand-footer { position: relative; z-index: 1; font-size: $font-size-sm; opacity: 0.75; }
.login__logo {
  width: 64px; height: 64px; background: rgba(255,255,255,0.2);
  border-radius: $radius-xl; display: flex; align-items: center; justify-content: center;
  margin-bottom: $spacing-lg; backdrop-filter: blur(10px);
  i { font-size: 28px; }
}
.login__form-container {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: $spacing-lg; background: $gray-50;
}
.login__card {
  width: 100%; max-width: 420px; background: $white;
  border-radius: $radius-xl; padding: $spacing-2xl; box-shadow: $shadow-lg;
}
.login__header { text-align: center; margin-bottom: $spacing-xl;
  h2 { font-size: $font-size-2xl; font-weight: 700; color: $gray-900; margin-bottom: $spacing-xs; }
  p { color: $gray-500; }
}
.form-group { margin-bottom: $spacing-lg;
  label { display: block; font-size: $font-size-sm; font-weight: 500; color: $gray-700; margin-bottom: $spacing-sm; }
}
.login__error { margin-bottom: $spacing-lg; }
.login__submit { margin-top: $spacing-sm; height: 48px; font-weight: 600; }
:deep(.p-inputtext), :deep(.p-password-input) { height: 44px; width: 100%; }
:deep(.p-password) { width: 100%; }
</style>
