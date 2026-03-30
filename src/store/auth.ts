import { defineStore } from 'pinia'

export const useAuthStore = defineStore('user', () => {
  const isLogin = ref(false)
  const user = ref<any>(null)

  return {
    isLogin,
    user,
  }
}, {
  persist: true,
})
