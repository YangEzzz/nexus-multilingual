<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger
} from '@/components/ui/navigation-menu'
import { useDark, useToggle } from '@vueuse/core'
import { removeToken } from '@/utils/auth'
import { logout } from '@/api/login'
import type { MenuItem as BackendMenuItem } from '@/api/menu/types'

// 定义组件名称解决linter错误
defineOptions({
  name: 'MainLayout'
})

const router = useRouter()

// 暗黑模式设置
const isDark = useDark()
const toggleDark = useToggle(isDark)

// 判断是否显示导航栏（登录和注册页面不显示）
const route = useRoute()
const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/register'
})

// 移动端菜单控制
const isMobileMenuOpen = ref(false)
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

// 菜单数据
type MenuItem = {
  id: string | number
  title: string
  path: string
  description?: string
  icon?: string
  children?: MenuItem[]
}


// 将后端菜单数据转换为前端UI格式
const transformMenuItem = (menu: BackendMenuItem): MenuItem => {
  return {
    id: menu.id,
    title: menu.name,
    path: menu.path || '', // 如果path为null，设置为空字符串
    icon: menu.icon as string | undefined,
    description: menu.name, // 使用name作为描述
    children: menu.children?.map(transformMenuItem) || [] // 递归转换children
  }
}

// 转换菜单数据用于导航显示
const menuData = computed(() => {
  const backendMenus = []
  const mainMenus = backendMenus.map(transformMenuItem)

  return {
    mainMenus
  }
})

// 处理退出登录
const handleLogout = async () => {
  try {
    // 调用登出API (登出API内部已经集成了路由重置)
    await logout()
    // 清除本地token
    removeToken()
    // 重定向到登录页
    router.push('/login')
  } catch (error) {
    console.error('登出错误:', error)
    // 即使API调用失败，也清除本地token并跳转到登录页
    removeToken()
    router.push('/login')
  }
}
</script>

<template>
  <!-- 导航菜单 -->
  <header v-if="!isAuthPage" class="border-b sticky top-0 bg-background z-10">
    <div class="flex h-16 items-center px-4 md:px-6">
      <!-- 移动端菜单按钮 -->
      <button
        class="md:hidden flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent transition-colors"
        aria-label="菜单"
        @click="toggleMobileMenu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- 桌面端导航菜单 -->
      <NavigationMenu class="hidden md:flex mx-6">
        <NavigationMenuList>
          <!-- Logo -->
          <div class="flex items-center mr-6">
            <img src="/icon.png" alt="Logo" class="h-8 w-auto mr-2" />
            <span class="text-xl font-bold">多语言聚合平台</span>
          </div>

          <!-- 主菜单项 -->
          <template v-for="item in menuData.mainMenus" :key="item.id">
            <!-- 有子菜单的项目 -->
            <NavigationMenuItem v-if="item.children && item.children.length > 0">
              <NavigationMenuTrigger>{{ item.title }}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul class="grid w-[400px] gap-3 p-4 md:grid-cols-2">
                  <li v-for="child in item.children" :key="child.id">
                    <NavigationMenuLink as-child>
                      <router-link
                        class="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        :to="child.path"
                      >
                        <div class="text-sm font-medium leading-none">{{ child.title }}</div>
                        <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          {{ child.description }}
                        </p>
                      </router-link>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <!-- 无子菜单的项目 -->
            <NavigationMenuItem v-else>
              <NavigationMenuLink as-child>
                <router-link
                  class="flex items-center px-3 py-2 rounded-md hover:bg-accent transition-colors"
                  :to="item.path"
                >
                  {{ item.title }}
                </router-link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </template>
        </NavigationMenuList>
      </NavigationMenu>

      <!-- 空白占位 -->
      <div class="md:hidden flex-1"></div>

      <div class="ml-auto flex items-center space-x-4">
        <!-- 暗黑模式切换按钮 -->
        <button
          class="p-2 rounded-md bg-background text-foreground border hover:bg-accent transition-all"
          aria-label="切换暗黑模式"
          @click="toggleDark()"
        >
          <!-- 太阳图标 (亮色模式) -->
          <svg
            v-if="isDark"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <!-- 月亮图标 (暗色模式) -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </button>

        <!-- 用户菜单，使用自定义下拉菜单替代Navigation菜单 -->
        <div class="relative group">
          <button class="flex items-center px-3 py-2 rounded-md group-hover:bg-accent transition-colors">
            用户
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            class="absolute right-0 top-full mt-1 w-48 bg-card border rounded-md shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
          >
            <ul class="py-1">
              <li>
                <router-link to="/" class="block px-4 py-2 hover:bg-accent transition-colors"> 个人资料 </router-link>
              </li>
              <li>
                <router-link to="/" class="block px-4 py-2 hover:bg-accent transition-colors"> 设置 </router-link>
              </li>
              <li>
                <button
                  class="block w-full text-left px-4 py-2 hover:bg-accent transition-colors"
                  @click="handleLogout"
                >
                  退出登录
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动端菜单展开层 -->
    <div v-show="isMobileMenuOpen" class="md:hidden bg-background border-b">
      <div class="px-4 py-3 space-y-1">
        <!-- 主菜单 -->
        <ul class="space-y-2">
          <li v-for="item in menuData.mainMenus" :key="item.id">
            <!-- 有子菜单的项目 -->
            <template v-if="item.children && item.children.length > 0">
              <div class="font-medium text-sm py-2">{{ item.title }}</div>
              <ul class="pl-3 space-y-1">
                <li v-for="child in item.children" :key="child.id">
                  <router-link :to="child.path" class="block px-2 py-1.5 rounded hover:bg-accent transition-colors">
                    {{ child.title }}
                  </router-link>
                </li>
              </ul>
            </template>

            <!-- 无子菜单的项目 -->
            <router-link v-else :to="item.path" class="block px-2 py-1.5 rounded hover:bg-accent transition-colors">
              {{ item.title }}
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </header>

  <!-- 主内容区 -->
  <main>
    <router-view></router-view>
  </main>
</template>

<style scoped>
/* 导航菜单样式调整 */
:deep(.navigation-menu-content) {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
}

/* 移动菜单动画 */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
