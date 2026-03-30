import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAuthStore } from '@/store'
import { api } from '@/request'
import { setToken, removeToken } from '@/utils/auth'

export function useAuth() {
  const router = useRouter()

  const authStore = useAuthStore()
  const { isLogin } = storeToRefs(authStore)
  const loading = ref(false)

  function logout() {
    isLogin.value = false
    // Also remove token, token is removed in request handler, but let's be explicit
    removeToken()

    router.push({ path: '/auth/sign-in' })
  }

  function toHome() {
    router.push({ path: '/' })
  }

  async function login(formData: Record<string, string>) {
    loading.value = true
    try {
      // 发送登录请求给 Nexus 后端
      const res = await api.post<any>({
        url: '/auth/login', // 如果需要加版本号，比如 '/v1/auth/login'，请以你的 api 配置前缀为准
        data: formData
      })

      // 假设 res.data 包含了 token 和 userInfo
      const { token, user } = res.data

      if (token) {
        setToken(token) // 你的内部 util
      }

      // 根据需要存入 AuthStore
      authStore.user = user
      authStore.isLogin = true

      toast.success('Login Successful', {
        description: `Welcome back, ${user.nickname || user.username || 'User'}!`,
      })

      const redirect = router.currentRoute.value.query.redirect as string
      if (!redirect || redirect.startsWith('//')) {
        toHome()
      }
      else {
        router.push(redirect)
      }
    } catch (error: any) {
      toast.error('Login Failed', {
        description: error.message || 'Invalid credentials or project mapping.',
      })
    } finally {
      loading.value = false
    }
  }

  async function getUserInfo() {
    if (!localStorage.getItem('nexus_token')) return null
    try {
      const res = await api.get<any>({
        url: '/auth/me', 
      })
      if (res.code === 200) {
        authStore.user = res.data
        authStore.isLogin = true
        return res.data
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      logout()
    }
    return null
  }

  return {
    loading,
    logout,
    login,
    getUserInfo,
  }
}
