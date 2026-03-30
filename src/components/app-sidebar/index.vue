<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/store'
import { sidebarData } from './data/sidebar-data'
import NavFooter from './nav-footer.vue'
import NavTeam from './nav-team.vue'
import TeamSwitcher from './team-switcher.vue'

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)
</script>

<template>
  <UiSidebar collapsible="icon" class="z-50">
    <UiSidebarHeader>
      <TeamSwitcher :teams="sidebarData.teams" />
    </UiSidebarHeader>

    <UiSidebarContent>
      <NavTeam :nav-main="sidebarData.navMain" />
    </UiSidebarContent>

    <UiSidebarFooter>
      <NavFooter :user="user || sidebarData.user" />
    </UiSidebarFooter>

    <UiSidebarRail />
  </UiSidebar>
</template>
