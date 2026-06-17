<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RoleLabels } from '@/types'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Avatar from 'primevue/avatar'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Can Suyu'
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const sidebarCollapsed = ref(false)
const userMenu = ref()

// Mobil: sidebar off-canvas drawer'a dönüşür (768px = $breakpoint-md).
const mobileOpen = ref(false)
const isMobile = ref(false)
let mq: MediaQueryList | null = null
function onMqChange(e: MediaQueryListEvent | MediaQueryList) {
  isMobile.value = e.matches
  if (!e.matches) mobileOpen.value = false // masaüstüne geçince drawer'ı kapat
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)')
  onMqChange(mq)
  mq.addEventListener('change', onMqChange)
})
onUnmounted(() => mq?.removeEventListener('change', onMqChange))

// Rota değişince mobil drawer'ı kapat
watch(() => route.path, () => { mobileOpen.value = false })

// Masaüstünde daraltma etiketleri gizler; mobil drawer'da etiketler her zaman görünür.
const showLabels = computed(() => isMobile.value || !sidebarCollapsed.value)

type MenuItem = { label: string; icon: string; route: string; module?: string; adminOnly?: boolean }

const menuItems: MenuItem[] = [
  { label: 'Gösterge Paneli', icon: 'pi pi-home', route: '/' },
  { label: 'Muhtaçlar', icon: 'pi pi-users', route: '/beneficiaries', module: 'beneficiaries' },
  { label: 'Yardımlar', icon: 'pi pi-heart-fill', route: '/aids', module: 'aids' },
  { label: 'Bağışçılar', icon: 'pi pi-gift', route: '/donors', module: 'donors' },
  { label: 'Envanter', icon: 'pi pi-box', route: '/inventory', module: 'inventory' },
  { label: 'Başvurular', icon: 'pi pi-inbox', route: '/applications', module: 'applications' },
  { label: 'Temsilciler', icon: 'pi pi-id-card', route: '/representatives', adminOnly: true },
]

const visibleItems = computed(() =>
  menuItems.filter((i) => {
    if (i.adminOnly && !auth.isAdmin) return false
    if (i.module && !auth.can(i.module as never, 'view')) return false
    return true
  }),
)

const userMenuItems = computed(() => [
  { label: 'Çıkış Yap', icon: 'pi pi-sign-out', command: async () => { await auth.logout(); router.push('/login') } },
])

function toggleUserMenu(event: Event) { userMenu.value.toggle(event) }

const pageTitle = computed(() => (route.meta.title as string) || 'Yönetim')
const userInitial = computed(() => auth.profile?.fullName?.charAt(0).toUpperCase() || 'K')
</script>

<template>
  <div class="layout" :class="{ 'layout--collapsed': sidebarCollapsed, 'layout--mobile-open': mobileOpen }">
    <div v-if="mobileOpen" class="overlay" @click="mobileOpen = false" />
    <aside class="sidebar">
      <div class="sidebar__header">
        <div class="sidebar__brand">
          <span class="sidebar__mark"><i class="pi pi-heart-fill" /></span>
          <span v-if="showLabels" class="sidebar__name">{{ APP_NAME }}</span>
        </div>
      </div>

      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in visibleItems"
          :key="item.route"
          :to="item.route"
          class="sidebar__link"
          :class="{ 'sidebar__link--active': route.path === item.route || (item.route !== '/' && route.path.startsWith(item.route)) }"
        >
          <i :class="item.icon" />
          <span v-if="showLabels">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div v-if="!isMobile" class="sidebar__footer">
        <Button
          :icon="sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
          text rounded severity="secondary"
          @click="sidebarCollapsed = !sidebarCollapsed"
        />
      </div>
    </aside>

    <div class="main">
      <header class="header">
        <div class="header__left">
          <Button
            class="header__burger" icon="pi pi-bars" text rounded severity="secondary"
            aria-label="Menü" @click="mobileOpen = true"
          />
          <h1 class="header__title">{{ pageTitle }}</h1>
        </div>
        <div class="header__right">
          <div class="header__user" @click="toggleUserMenu">
            <Avatar :label="userInitial" shape="circle" :style="{ backgroundColor: '#6366f1', color: '#fff' }" />
            <div class="header__userinfo">
              <span class="header__username">{{ auth.profile?.fullName || '—' }}</span>
              <span class="header__role">{{ auth.role ? RoleLabels[auth.role] : '' }}</span>
            </div>
            <i class="pi pi-chevron-down header__caret" />
          </div>
          <Menu ref="userMenu" :model="userMenuItems" :popup="true" />
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.layout { display: flex; min-height: 100vh; background: $gray-50; }
.layout--collapsed .sidebar { width: $sidebar-collapsed-width; }
.layout--collapsed .main { margin-left: $sidebar-collapsed-width; }

.sidebar {
  position: fixed; inset: 0 auto 0 0; width: $sidebar-width;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: $white; display: flex; flex-direction: column;
  transition: width 0.2s ease, transform 0.2s ease; z-index: 100;

  &__header { padding: $spacing-lg; border-bottom: 1px solid rgba(255,255,255,0.08); }
  &__brand { display: flex; align-items: center; gap: $spacing-md; }
  &__mark {
    width: 36px; height: 36px; border-radius: $radius-md;
    background: linear-gradient(135deg, #0ea5e9, #6366f1);
    display: flex; align-items: center; justify-content: center;
    i { font-size: 18px; color: $white; }
  }
  &__name { font-weight: 700; font-size: $font-size-lg; }

  &__nav { flex: 1; padding: $spacing-md 0; overflow-y: auto; }

  &__link {
    display: flex; align-items: center; gap: $spacing-md;
    padding: $spacing-md $spacing-lg;
    color: rgba(255,255,255,0.65); text-decoration: none; cursor: pointer;
    border-left: 3px solid transparent; transition: all 0.15s ease;

    &:hover { background: rgba(255,255,255,0.06); color: $white; }
    &--active {
      background: rgba(99,102,241,0.15); color: $white;
      border-left-color: #6366f1;
    }
    i { font-size: 1.1rem; width: 1.25rem; text-align: center; }
  }

  &__footer { padding: $spacing-md; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; }
}

.main { flex: 1; margin-left: $sidebar-width; transition: margin-left 0.2s ease; display: flex; flex-direction: column; }

.header {
  display: flex; justify-content: space-between; align-items: center;
  height: $header-height; padding: 0 $spacing-xl;
  background: $white; border-bottom: 1px solid $gray-200;
  position: sticky; top: 0; z-index: 50;
  &__left { display: flex; align-items: center; gap: $spacing-sm; min-width: 0; }
  &__burger { display: none; flex-shrink: 0; }
  &__title { font-size: $font-size-xl; font-weight: 600; color: $gray-900; @include text-truncate; }
  &__right { display: flex; align-items: center; gap: $spacing-md; }
  &__user {
    display: flex; align-items: center; gap: $spacing-sm; cursor: pointer;
    padding: $spacing-xs $spacing-sm; border-radius: $radius-md;
    &:hover { background: $gray-100; }
  }
  &__userinfo { display: flex; flex-direction: column; line-height: 1.1; }
  &__username { font-weight: 600; font-size: $font-size-base; color: $gray-900; }
  &__role { font-size: $font-size-sm; color: $gray-500; }
  &__caret { color: $gray-400; font-size: 0.75rem; }
}

.content { flex: 1; padding: $spacing-xl; }

// Mobil drawer arka plan örtüsü (sidebar 100 ile içerik arasında).
.overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 90;
}

// Mobil: sidebar off-canvas drawer'a dönüşür, içerik tam genişlik olur.
@media (max-width: $breakpoint-md) {
  .sidebar {
    transform: translateX(-100%);
    width: $sidebar-width; // drawer daima tam genişlik
    box-shadow: $shadow-lg;
  }
  .layout--collapsed .sidebar { width: $sidebar-width; } // mobilde daraltmayı yok say
  .layout--mobile-open .sidebar { transform: translateX(0); }

  .main,
  .layout--collapsed .main { margin-left: 0; }

  .header { padding: 0 $spacing-md; }
  .header__burger { display: inline-flex; }
  .header__userinfo { display: none; } // dar ekranda yalnızca avatar
  .content { padding: $spacing-md; }
}
</style>
