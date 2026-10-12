import type { SessionUser } from '@/types/domain'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('user', () => {
  const isLogin = ref(false)
  const user = ref<SessionUser | null>(null)
  const initialized = ref(false)

  return {
    isLogin,
    user,
    initialized,
  }
}, {
  persist: false,
})
