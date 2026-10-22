<script lang="ts" setup>
import { storeToRefs } from 'pinia'

import { RADIUS } from '@/constants/themes'
import { useThemeStore } from '@/store'

const themeStore = useThemeStore()
const { setRadius } = themeStore
const { radius } = storeToRefs(themeStore)
</script>

<template>
  <div class="space-y-1.5 pt-6">
    <p class="text-xs font-medium">
      圆角大小
    </p>
    <div class="grid grid-cols-3 gap-2 py-1.5">
      <UiButton
        v-for="rayon in RADIUS" :key="rayon"
        variant="outline"
        class="justify-center h-8 px-3"
        :class="rayon === radius ? 'border-primary bg-accent text-accent-foreground' : ''"
        :aria-pressed="rayon === radius"
        @click="setRadius(rayon)"
      >
        <span class="text-xs">{{ rayon * 16 }}px</span>
      </UiButton>
    </div>
  </div>
</template>
