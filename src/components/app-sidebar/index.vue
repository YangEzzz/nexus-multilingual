<script lang="ts" setup>
import { Languages } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import ThemePopover from '@/components/custom-theme/theme-popover.vue'
import ToggleTheme from '@/components/toggle-theme.vue'
import { useAuthStore } from '@/store'
import { sidebarData } from './data/sidebar-data'
import NavFooter from './nav-footer.vue'
import NavTeam from './nav-team.vue'

const { user } = storeToRefs(useAuthStore())
</script>

<template>
  <UiSidebar collapsible="icon" class="z-50">
    <UiSidebarHeader class="border-b border-sidebar-border px-3 py-6">
      <RouterLink to="/dashboard" aria-label="Nexus 多语言工作台，前往项目总览" class="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 focus-visible:ring-2 focus-visible:ring-ring">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Languages class="size-5" /></span>
        <span class="min-w-0 group-data-[collapsible=icon]:hidden">
          <span class="block text-xl font-semibold tracking-tight">Nexus</span>
          <span class="mt-0.5 block text-xs text-muted-foreground">多语言工作台</span>
        </span>
      </RouterLink>
    </UiSidebarHeader>
    <UiSidebarContent class="px-2 py-4">
      <NavTeam :nav-main="sidebarData.navMain" />
    </UiSidebarContent>
    <div class="mx-4 mb-5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4 group-data-[collapsible=icon]:hidden">
      <p class="text-xs font-semibold">
        从原文到发布
      </p>
      <p class="mt-2 text-xs leading-5 text-muted-foreground">
        在同一个工作空间录入词条、补齐译文、校对并发布。
      </p>
    </div>
    <UiSidebarFooter class="border-t border-sidebar-border px-3 py-4">
      <div class="mb-3 flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
        <span class="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">外观与导航</span>
        <div class="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <ToggleTheme /><ThemePopover /><UiSidebarTrigger class="hidden md:flex" aria-label="展开或收起导航" />
        </div>
      </div>
      <NavFooter :user="user || sidebarData.user" />
    </UiSidebarFooter>
    <UiSidebarRail />
  </UiSidebar>
</template>
