<script setup lang="ts">
import {
  LogOut,
  UserRoundCog,
  ChevronsUpDown,
} from 'lucide-vue-next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/composables/use-auth'

const { user } = defineProps<{
  user: {
    nickname?: string
    avatar?: string
    role?: string
    name?: string
    email?: string
  }
}>()

const { logout } = useAuth()
const { isMobile, open } = useSidebar()
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="size-8 rounded-lg">
              <AvatarImage :src="user.avatar || ''" :alt="user.nickname || user.name" />
              <AvatarFallback class="rounded-lg bg-primary text-primary-foreground font-bold">
                {{ (user.nickname || user.name || 'U').charAt(0).toUpperCase() }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-sm leading-tight text-left">
              <span class="font-semibold truncate">{{ user.nickname || user.name }}</span>
              <span class="text-xs truncate text-muted-foreground">{{ user.role || 'Member' }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4 opacity-50 transition-opacity group-hover:opacity-100" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          :side="(isMobile || open) ? 'bottom' : 'right'"
          align="start"
          :side-offset="4"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="size-8 rounded-lg">
                <AvatarImage :src="user.avatar || ''" :alt="user.nickname || user.name" />
                <AvatarFallback class="rounded-lg bg-primary text-primary-foreground font-bold text-[10px]">
                  {{ (user.nickname || user.name || 'U').charAt(0).toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-sm leading-tight text-left">
                <span class="font-semibold truncate">{{ user.nickname || user.name }}</span>
                <span class="text-xs truncate text-muted-foreground">{{ user.role || 'Member' }}</span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <DropdownMenuItem 
              class="cursor-pointer transition-colors focus:bg-sidebar-accent" 
              @click="$router.push('/settings/')"
            >
              <UserRoundCog class="size-4 mr-2" />
              Profile Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            class="cursor-pointer transition-colors focus:bg-destructive focus:text-destructive-foreground" 
            @click="logout"
          >
            <LogOut class="size-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
