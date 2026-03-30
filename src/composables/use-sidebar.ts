import type { NavGroup } from '@/components/app-sidebar/types'

import { BellDot, FolderOpen, LayoutDashboard, Languages, Palette, PictureInPicture2, User, Wrench } from 'lucide-vue-next'

export const useSidebar = () => {
  const settingsNavItems = [
    { title: 'Profile', url: '/settings/', icon: User },
    { title: 'Account', url: '/settings/account', icon: Wrench },
    { title: 'Appearance', url: '/settings/appearance', icon: Palette },
    { title: 'Notifications', url: '/settings/notifications', icon: BellDot },
    { title: 'Display', url: '/settings/display', icon: PictureInPicture2 },
  ]

  const navData = ref<NavGroup[]>([
    {
      title: '工作空间',
      items: [
        { title: '项目总览', url: '/dashboard', icon: LayoutDashboard },
        { title: '项目管理', url: '/projects', icon: FolderOpen },
        { title: '多语言工作台', url: '/workbench', icon: Languages },
      ],
    },
  ])

  const otherPages = ref<NavGroup[]>([])

  return {
    navData,
    otherPages,
    settingsNavItems,
  }
}
