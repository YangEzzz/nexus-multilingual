<script lang="ts" setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/use-auth'

const { login, loading } = useAuth()

const formData = ref({
  email: '',
  password: '',
  project_id_string: 'nexus-multilingual'
})

const handleLogin = async () => {
  if (!formData.value.email || !formData.value.password) {
    // Basic validation, ideally use vee-validate if this project prefers
    return
  }
  await login(formData.value)
}
</script>

<template>
  <UiCard class="w-full border shadow-lg dark:bg-zinc-950/50 backdrop-blur-sm">
    <UiCardHeader class="space-y-2 text-center">
      <UiCardTitle class="text-2xl font-semibold tracking-tight">
        登录账号
      </UiCardTitle>
      <UiCardDescription class="text-muted-foreground">
        使用 Helios 账号登录多语言工作台
      </UiCardDescription>
    </UiCardHeader>
    <UiCardContent class="grid gap-6">
      <form @submit.prevent="handleLogin" class="grid gap-4">
        <div class="grid gap-2">
          <UiLabel for="email">邮箱</UiLabel>
          <UiInput 
            id="email" 
            v-model="formData.email" 
            type="email"
            placeholder="请输入邮箱" 
            required 
            class="transition-all duration-200 focus-visible:ring-2"
          />
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <UiLabel for="password">密码</UiLabel>
          </div>
          <UiInput 
            id="password" 
            v-model="formData.password" 
            type="password" 
            required 
            placeholder="••••••••" 
            class="transition-all duration-200 focus-visible:ring-2"
          />
        </div>

        <UiButton type="submit" class="w-full mt-2 transition-all hover:scale-[1.02] active:scale-[0.98]" :disabled="loading">
          <UiSpinner v-if="loading" class="mr-2 h-4 w-4" />
          {{ loading ? '登录中...' : '登录' }}
        </UiButton>
      </form>
    </UiCardContent>
  </UiCard>
</template>
