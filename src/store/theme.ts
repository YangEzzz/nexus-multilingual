import type { ContentLayout, Radius, Theme } from '@/constants/themes'

import { defineStore } from 'pinia'

export const useThemeStore = defineStore('system-config', () => {
  const radius = ref(0.5)
  const setRadius = (newRadius: Radius) => {
    radius.value = newRadius
  }
  const theme = ref<Theme>('zinc')
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  const contentLayout = ref<ContentLayout>('centered')
  const setContentLayout = (newContentLayout: ContentLayout) => {
    contentLayout.value = newContentLayout
  }
  return {
    radius,
    setRadius,

    theme,
    setTheme,

    contentLayout,
    setContentLayout,
  }
}, {
  persist: true,
})
