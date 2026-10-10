import { defineStore } from 'pinia'

export const useAuthStore = defineStore('user', () => {
  const isLogin = ref(false)
  const user = ref<any>(null)
  const initialized = ref(false)

  return {
    isLogin,
    user,
    initialized,
  }
}, {
  persist: false,
})
