import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/store'
import { authRequest, clearLegacyAuth } from '@/utils/session'

let profileRequest: Promise<any> | null = null

export function useSessionAuth() {
  const router = useRouter()
  const store = useAuthStore()
  const loading = ref(false)

  async function logout() {
    if (loading.value)
      return
    loading.value = true
    try {
      await authRequest('/logout', {})
      store.isLogin = false
      store.user = null
      store.initialized = true
      clearLegacyAuth()
      await router.push('/auth/sign-in')
    }
    catch (error) { toast.error(error instanceof Error ? error.message : '退出失败，请重试') }
    finally { loading.value = false }
  }

  async function getUserInfo() {
    if (!profileRequest) {
      clearLegacyAuth()
      profileRequest = authRequest<any>('/me')
        .then((user) => {
          store.user = user
          store.isLogin = true
          return user
        })
        .catch(() => {
          store.user = null
          store.isLogin = false
          return null
        })
        .finally(() => {
          store.initialized = true
          profileRequest = null
        })
    }
    return profileRequest
  }

  return { loading, logout, getUserInfo }
}
