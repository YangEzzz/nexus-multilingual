<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuthStore } from '@/store'
import { sidebarData } from './data/sidebar-data'
import NavFooter from './nav-footer.vue'
import NavTeam from './nav-team.vue'
import TeamSwitcher from './team-switcher.vue'

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)
const { isMobile } = useSidebar()
</script>

<template>
  <UiSidebar
    :collapsible="isMobile ? 'offcanvas' : 'none'"
    class="sticky top-0 z-50 h-svh self-start border-r border-sidebar-border"
  >
    <UiSidebarHeader>
      <TeamSwitcher :teams="sidebarData.teams" />
    </UiSidebarHeader>

    <UiSidebarContent>
      <NavTeam :nav-main="sidebarData.navMain" />
    </UiSidebarContent>

    <UiSidebarFooter class="gap-1 border-t border-sidebar-border/70 p-2">
      <NavFooter :user="user || sidebarData.user" />
    </UiSidebarFooter>
  </UiSidebar>
</template>
