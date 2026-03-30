<script setup lang="ts">
import { onMounted } from 'vue'
import Loading from '@/components/Loading.vue'
import { Toaster } from '@/components/ui/sonner'
import { useSystemTheme } from '@/composables/use-system-theme'
import { useAuth } from '@/composables/use-auth'

const { getUserInfo } = useAuth()
useSystemTheme()

onMounted(async () => {
  await getUserInfo()
})
</script>

<template>
  <Toaster />

  <Suspense>
    <router-view v-slot="{ Component, route }">
      <component :is="Component" :key="route" />
    </router-view>

    <template #fallback>
      <Loading />
    </template>
  </Suspense>
</template>
