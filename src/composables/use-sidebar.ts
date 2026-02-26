import type { NavGroup } from '@/components/app-sidebar/types'

import { BellDot, Bug, CreditCard, LayoutDashboard, ListTodo, Languages, Palette, PictureInPicture2, SquareUserRound, User, Wrench } from 'lucide-vue-next'

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
      title: 'General',
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        { title: 'Tasks', url: '/tasks', icon: ListTodo },
        { title: 'Workbench', url: '/workbench', icon: Languages },
      ],
    },
    {
      title: 'Pages',
      items: [
        {
          title: 'Auth',
          icon: SquareUserRound,
          items: [
            { title: 'Sign In', url: '/auth/sign-in' },
            { title: 'Sign In(2 Col)', url: '/auth/sign-in-2' },
            { title: 'Sign Up', url: '/auth/sign-up' },
            { title: 'Forgot Password', url: '/auth/forgot-password' },
            { title: 'OTP', url: '/auth/otp' },
          ],
        },
        {
          title: 'Errors',
          icon: Bug,
          items: [
            { title: '401 | Unauthorized', url: '/errors/401' },
            { title: '403 | Forbidden', url: '/errors/403' },
            { title: '404 | Not Found', url: '/errors/404' },
            { title: '500 | Internal Server Error', url: '/errors/500' },
            { title: '503 | Maintenance Error', url: '/errors/503' },
          ],
        },
      ],
    },
  ])

  const otherPages = ref<NavGroup[]>([
    {
      title: 'Other',
      items: [
        {
          title: 'Plans & Pricing',
          icon: CreditCard,
          url: '/billing',
        },
      ],
    },
  ])

  return {
    navData,
    otherPages,
    settingsNavItems,
  }
}
