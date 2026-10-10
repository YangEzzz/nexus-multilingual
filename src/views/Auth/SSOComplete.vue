<script setup lang="ts">
import type { LoginStatus } from '@/composables/use-helios-login'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionAuth } from '@/composables/use-session-auth'
import { authRequest, safeReturnPath } from '@/utils/session'

const route = useRoute()
const router = useRouter()
const { getUserInfo } = useSessionAuth()
const title = ref('正在打开 Helios')
const message = ref('请稍候，登录窗口正在准备中。')
const busy = ref(true)
const failed = ref(false)
const transaction = typeof route.query.transaction === 'string' ? route.query.transaction : ''
const destination = ref('/dashboard')

async function enter() {
  if (await getUserInfo())
    await router.replace(destination.value)
  else await router.replace('/auth/sign-in')
}

onMounted(async () => {
  if (route.query.waiting === '1')
    return
  try {
    if (!transaction)
      throw new Error('登录请求已失效，请返回应用重新登录')
    const status = await authRequest<LoginStatus>(`/sso/status?transaction=${encodeURIComponent(transaction)}`)
    if (status.status !== 'success')
      throw new Error(status.message || '登录未完成，请重新登录')
    title.value = '登录成功'
    message.value = '可以返回原窗口继续工作。此窗口将自动关闭。'
    destination.value = safeReturnPath(status.return_path)
    if (status.mode === 'redirect') {
      await enter()
      return
    }
    window.opener?.postMessage({ type: 'nexus:login-complete', transaction }, window.location.origin)
    window.close()
  }
  catch (cause) {
    failed.value = true
    title.value = '登录未完成'
    message.value = cause instanceof Error ? cause.message : '请返回应用重新登录'
    window.opener?.postMessage({ type: 'nexus:login-complete', transaction }, window.location.origin)
  }
  finally { busy.value = false }
})
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-background p-6">
    <UiCard class="w-full max-w-sm">
      <UiCardHeader>
        <UiCardTitle>{{ title }}</UiCardTitle>
        <UiCardDescription aria-live="polite">
          {{ message }}
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <UiSpinner v-if="busy" class="size-5" aria-label="正在准备登录" />
        <UiButton v-else class="w-full cursor-pointer" @click="failed ? router.replace('/auth/sign-in') : enter()">
          {{ failed ? '返回登录' : '进入工作台' }}
        </UiButton>
      </UiCardContent>
    </UiCard>
  </main>
</template>
