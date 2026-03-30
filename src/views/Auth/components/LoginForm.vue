<script lang="ts" setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/use-auth'

import PrivacyPolicyButton from './PrivacyPolicyButton.vue'
import TermsOfServiceButton from './TermsOfServiceButton.vue'

const { login, loading } = useAuth()

const formData = ref({
  username: '',
  password: '',
  project_id_string: 'nexus-multilingual'
})

const handleLogin = async () => {
  if (!formData.value.username || !formData.value.password) {
    // Basic validation, ideally use vee-validate if this project prefers
    return
  }
  await login(formData.value)
}
</script>

<template>
  <UiCard class="w-full max-w-sm border-0 shadow-lg dark:bg-zinc-950/50 backdrop-blur-sm">
    <UiCardHeader class="space-y-2 text-center">
      <UiCardTitle class="text-3xl font-semibold tracking-tight">
        Welcome Back
      </UiCardTitle>
      <UiCardDescription class="text-muted-foreground">
        Log into your workspace via the central management system.
      </UiCardDescription>
    </UiCardHeader>
    <UiCardContent class="grid gap-6">
      <form @submit.prevent="handleLogin" class="grid gap-4">
        <div class="grid gap-2">
          <UiLabel for="username">Username</UiLabel>
          <UiInput 
            id="username" 
            v-model="formData.username" 
            placeholder="Enter your username" 
            required 
            class="transition-all duration-200 focus-visible:ring-2"
          />
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <UiLabel for="password">Password</UiLabel>
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
          {{ loading ? 'Authenticating...' : 'Sign In' }}
        </UiButton>
      </form>

      <UiCardDescription class="text-center text-xs mt-4">
        By clicking login, you agree to our
        <TermsOfServiceButton />
        and
        <PrivacyPolicyButton />
      </UiCardDescription>
    </UiCardContent>
  </UiCard>
</template>
