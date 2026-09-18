<script setup lang="ts">
import { storeToRefs } from 'pinia'

import AppSidebar from '@/components/app-sidebar/index.vue'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store'

const themeStore = useThemeStore()
const { contentLayout } = storeToRefs(themeStore)
</script>

<template>
  <SidebarProvider :open="true" :keyboard-shortcut="false">
    <AppSidebar />
    <SidebarInset class="min-w-0 flex-1 bg-background">
      <div class="sticky top-0 z-40 flex h-12 shrink-0 items-center border-b border-border/70 bg-background/95 px-3 backdrop-blur md:hidden">
        <SidebarTrigger aria-label="打开导航菜单" />
        <span class="ml-2 text-sm font-medium text-foreground">导航菜单</span>
      </div>
      <div
        :class="cn(
          'min-w-0 grow',
          contentLayout === 'centered' ? 'container mx-auto' : '',
        )"
      >
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="['dashboard', 'workbench', 'projects', 'project-logs']">
            <component :is="Component" :key="route.fullPath" />
          </keep-alive>
        </router-view>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
