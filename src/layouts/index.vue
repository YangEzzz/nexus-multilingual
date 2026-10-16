<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/app-sidebar/index.vue'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useThemeStore } from '@/store'

const { contentLayout } = storeToRefs(useThemeStore())
const route = useRoute()
const titles: Record<string, string> = {
  'dashboard': '项目总览',
  'projects': '项目管理',
  'workbench': '多语言工作台',
  'available-languages': '可选语言',
  'project-logs': '操作日志',
  'ai-settings': 'AI 翻译设置',
  'tasks': '任务',
}
const pageTitle = computed(() => titles[String(route.name)] || '工作空间')
watch(pageTitle, title => document.title = `${title} · Nexus`, { immediate: true })
</script>

<template>
  <SidebarProvider>
    <a href="#page-content" class="skip-link">跳转到页面内容</a>
    <AppSidebar />
    <SidebarInset class="min-w-0 flex-1">
      <SidebarTrigger class="fixed left-3 top-3 z-40 size-9 border bg-card shadow-sm md:hidden" aria-label="打开导航菜单" />
      <div id="page-content" tabindex="-1" class="app-content min-w-0 grow pt-12 outline-none md:pt-0" :class="contentLayout === 'centered' ? 'mx-auto w-full max-w-[1560px]' : 'w-full'">
        <router-view v-slot="{ Component, route: activeRoute }">
          <keep-alive :include="['dashboard', 'workbench', 'projects', 'project-logs', 'AiSettings']">
            <component :is="Component" :key="activeRoute.fullPath" />
          </keep-alive>
        </router-view>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
