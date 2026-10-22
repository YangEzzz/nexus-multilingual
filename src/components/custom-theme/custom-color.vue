<script lang="ts" setup>
import { storeToRefs } from 'pinia'

import { THEME_LABELS, THEME_PRIMARY_COLORS } from '@/constants/themes'
import { useThemeStore } from '@/store'

const themeStore = useThemeStore()
const { setTheme } = themeStore
const { theme: t } = storeToRefs(themeStore)
</script>

<template>
  <div class="space-y-1.5 pt-6">
    <p class="text-xs font-medium">
      主题颜色
    </p>
    <div class="grid grid-cols-2 gap-2 py-1.5">
      <UiButton
        v-for="theme in THEME_PRIMARY_COLORS" :key="theme.theme"
        variant="outline"
        class="justify-center h-8 px-3"
        :class="t === theme.theme ? 'border-primary bg-accent text-accent-foreground' : ''"
        :aria-pressed="t === theme.theme"
        @click="setTheme(theme.theme)"
      >
        <span
          :style="{
            '--theme-primary': theme.primaryColor,
          }"
          class="size-2 rounded-full bg-(--theme-primary)"
        />
        <span class="text-xs">{{ THEME_LABELS[theme.theme] }}</span>
      </UiButton>
    </div>
  </div>
</template>
