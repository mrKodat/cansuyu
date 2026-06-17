import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/firebase'
import { getRepresentativeByUid, touchLogin } from '@/services/representatives'
import type { Representative, Role, Module, Action } from '@/types'
import { RolePermissions } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const firebaseUser = ref<FirebaseUser | null>(null)
  const profile = ref<Representative | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!firebaseUser.value && !!profile.value && profile.value.active)
  const role = computed<Role | null>(() => profile.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')

  function can(module: Module, action: Action): boolean {
    if (!role.value) return false
    return RolePermissions[role.value]?.[module]?.includes(action) ?? false
  }

  async function loadProfile(user: FirebaseUser) {
    const rep = await getRepresentativeByUid(user.uid)
    profile.value = rep
    if (rep && !rep.active) {
      await signOut(auth)
      firebaseUser.value = null
      profile.value = null
      error.value = 'Hesabınız pasif durumda. Yöneticinize başvurun.'
    }
  }

  function initialize(): Promise<void> {
    return new Promise((resolve) => {
      if (initialized.value) return resolve()
      onAuthStateChanged(auth, async (user) => {
        firebaseUser.value = user
        if (user) {
          await loadProfile(user)
        } else {
          profile.value = null
        }
        initialized.value = true
        resolve()
      })
    })
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      firebaseUser.value = cred.user
      await loadProfile(cred.user)
      if (!profile.value) {
        await signOut(auth)
        throw new Error('Kullanıcı profili bulunamadı. Yönetici ile iletişime geçin.')
      }
      await touchLogin(cred.user.uid)
      return true
    } catch (e) {
      const err = e as { code?: string; message?: string }
      error.value = translateAuthError(err.code) ?? err.message ?? 'Giriş başarısız'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await signOut(auth)
    firebaseUser.value = null
    profile.value = null
  }

  return {
    firebaseUser, profile, initialized, loading, error,
    isAuthenticated, isAdmin, role,
    can, initialize, login, logout,
  }
})

function translateAuthError(code?: string): string | null {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-posta veya şifre hatalı.'
    case 'auth/too-many-requests':
      return 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.'
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı hatası.'
    case 'auth/user-disabled':
      return 'Bu hesap devre dışı.'
    default:
      return null
  }
}
