<script lang="ts" setup>
import { storeToRefs } from 'pinia'

import { CONTENT_LAYOUTS } from '@/constants/themes'
import { useThemeStore } from '@/store'

const themeStore = useThemeStore()
const { setContentLayout } = themeStore
const { contentLayout } = storeToRefs(themeStore)
</script>

<template>
  <div class="space-y-1.5 pt-6">
    <p class="text-xs font-medium">
      内容布局
    </p>
    <div class="grid grid-cols-2 gap-2 py-1.5">
      <UiButton
        v-for="layout in CONTENT_LAYOUTS" :key="layout.label"
        variant="outline"
        class="justify-center h-8 px-3"
        :class="contentLayout === layout.value ? 'border-primary bg-accent text-accent-foreground' : ''"
        :aria-pressed="contentLayout === layout.value"
        @click="setContentLayout(layout.value)"
      >
        <component :is="layout.icon" />
        {{ layout.label }}
      </UiButton>
    </div>
  </div>
</template>
