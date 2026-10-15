import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Module } from '@/types'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    guest?: boolean
    module?: Module
    adminOnly?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/features/auth/LoginPage.vue'),
    meta: { guest: true, title: 'Giriş' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('@/features/dashboard/DashboardPage.vue'), meta: { title: 'Gösterge Paneli' } },

      { path: 'beneficiaries', name: 'beneficiaries', component: () => import('@/features/beneficiaries/BeneficiariesPage.vue'), meta: { title: 'Muhtaçlar', module: 'beneficiaries' } },
      { path: 'beneficiaries/new', name: 'beneficiary-new', component: () => import('@/features/beneficiaries/BeneficiaryFormPage.vue'), meta: { title: 'Yeni Muhtaç', module: 'beneficiaries' } },
      { path: 'beneficiaries/:id', name: 'beneficiary-detail', component: () => import('@/features/beneficiaries/BeneficiaryDetailPage.vue'), meta: { title: 'Muhtaç Detayı', module: 'beneficiaries' } },
      { path: 'beneficiaries/:id/edit', name: 'beneficiary-edit', component: () => import('@/features/beneficiaries/BeneficiaryFormPage.vue'), meta: { title: 'Muhtaç Düzenle', module: 'beneficiaries' } },

      { path: 'donors', name: 'donors', component: () => import('@/features/donors/DonorsPage.vue'), meta: { title: 'Bağışçılar', module: 'donors' } },

      { path: 'aids', name: 'aids', component: () => import('@/features/aids/AidsPage.vue'), meta: { title: 'Yardımlar', module: 'aids' } },
      { path: 'aids/new', name: 'aid-new', component: () => import('@/features/aids/AidFormPage.vue'), meta: { title: 'Yeni Yardım', module: 'aids' } },
      { path: 'aids/:id', name: 'aid-detail', component: () => import('@/features/aids/AidDetailPage.vue'), meta: { title: 'Yardım Detayı', module: 'aids' } },

      { path: 'inventory', name: 'inventory', component: () => import('@/features/inventory/InventoryPage.vue'), meta: { title: 'Envanter', module: 'inventory' } },

      { path: 'applications', name: 'applications', component: () => import('@/features/applications/ApplicationsPage.vue'), meta: { title: 'Başvurular', module: 'applications' } },

      { path: 'representatives', name: 'representatives', component: () => import('@/features/representatives/RepresentativesPage.vue'), meta: { title: 'Temsilciler', module: 'representatives', adminOnly: true } },

      { path: 'backup', name: 'backup', component: () => import('@/features/backup/BackupPage.vue'), meta: { title: 'Yedekleme', adminOnly: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/features/auth/NotFoundPage.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) await auth.initialize()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: 'dashboard' }
  }
  if (to.meta.module && auth.isAuthenticated && !auth.can(to.meta.module, 'view')) {
    return { name: 'dashboard' }
  }
})

export default router
