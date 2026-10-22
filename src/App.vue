<script setup lang="ts">
import { onMounted } from 'vue'
import AppUiProvider from '@/components/AppUiProvider.vue'
import Loading from '@/components/Loading.vue'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/composables/use-auth'
import { useSystemTheme } from '@/composables/use-system-theme'

const { getUserInfo } = useAuth()
useSystemTheme()

onMounted(async () => {
  await getUserInfo()
})
</script>

<template>
  <AppUiProvider>
    <Toaster />

    <Suspense>
      <router-view v-slot="{ Component, route }">
        <component :is="Component" :key="route" />
      </router-view>

      <template #fallback>
        <Loading />
      </template>
    </Suspense>
  </AppUiProvider>
</template>
