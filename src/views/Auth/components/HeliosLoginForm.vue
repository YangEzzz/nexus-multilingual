<script lang="ts" setup>
import { ArrowUpRight, ShieldCheck } from 'lucide-vue-next'
import { useHeliosLogin } from '@/composables/use-helios-login'

const { login, cancel, loading, error } = useHeliosLogin()
</script>

<template>
  <UiCard class="w-full">
    <UiCardHeader class="space-y-3">
      <ShieldCheck data-tone="info" class="detail-text size-8" aria-hidden="true" />
      <UiCardTitle class="text-2xl tracking-tight">
        登录多语言工作台
      </UiCardTitle>
      <UiCardDescription>使用 Helios 账号，继续你的翻译与发布工作。</UiCardDescription>
    </UiCardHeader>
    <UiCardContent class="grid gap-4">
      <p class="min-h-10 text-sm text-muted-foreground">
        将在独立窗口中完成登录。已登录 Helios 时，可直接使用当前账号。
      </p>
      <div class="min-h-12 text-sm" aria-live="polite">
        <p v-if="error" role="alert" class="text-destructive">
          {{ error }}
        </p>
        <p v-else-if="loading" class="text-muted-foreground">
          请在 Helios 窗口中完成登录，完成后此页面会自动进入工作台。
        </p>
      </div>
      <UiButton class="h-11 w-full cursor-pointer" :disabled="loading" :aria-busy="loading" @click="login()">
        <UiSpinner v-if="loading" class="mr-2 size-4" />
        <ShieldCheck v-else class="mr-2 size-4" />
        使用 Helios 登录
      </UiButton>
      <UiButton variant="ghost" class="w-full cursor-pointer" @click="login(true)">
        {{ loading ? '改为当前页面登录' : '在当前页面登录' }} <ArrowUpRight class="ml-2 size-4" />
      </UiButton>
      <UiButton v-if="loading" variant="ghost" class="w-full cursor-pointer" @click="cancel">
        取消登录
      </UiButton>
      <p class="text-xs text-muted-foreground">
        没有访问权限？请联系管理员将你的账号加入 Nexus 项目。
      </p>
    </UiCardContent>
  </UiCard>
</template>
