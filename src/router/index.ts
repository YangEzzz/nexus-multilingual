import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

// 定义公共路由（不需要登录即可访问）
// const publicRoutes = ['/login', '/register', '/404']

// 基础路由 - 不需要权限控制的路由
const baseRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
    component: () => import('@/layouts/index.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard/index.vue'),
      },
    ],
  },
  {
    path: '/tasks',
    component: () => import('@/layouts/index.vue'),
    children: [
      {
        path: '',
        name: 'tasks',
        component: () => import('@/views/Tasks/index.vue'),
      },
      {
        path: '/workbench',
        name: 'workbench',
        component: () => import('@/views/Workbench/index.vue'),
      },
      {
        path: '/projects',
        name: 'projects',
        component: () => import('@/views/Projects/index.vue'),
      },
      {
        path: '/project-logs',
        name: 'project-logs',
        component: () => import('@/views/Workbench/Logs.vue'),
      },
    ],
  },
  // Auth routes - 认证相关路由
  {
    path: '/auth',
    children: [
      {
        path: 'sign-in',
        name: 'sign-in',
        component: () => import('@/views/Auth/SignIn.vue'),
      },
      {
        path: 'sign-in-2',
        name: 'sign-in-2',
        component: () => import('@/views/Auth/SignIn2.vue'),
      },
      {
        path: 'sign-up',
        name: 'sign-up',
        component: () => import('@/views/Auth/SignUp.vue'),
      },
      {
        path: 'forgot-password',
        name: 'forgot-password',
        component: () => import('@/views/Auth/ForgotPassword.vue'),
      },
      {
        path: 'otp',
        name: 'otp',
        component: () => import('@/views/Auth/Otp.vue'),
      },
    ],
  },
  // Error routes - 错误页面路由
  {
    path: '/errors',
    children: [
      {
        path: '401',
        name: 'error-401',
        component: () => import('@/views/Errors/401.vue'),
      },
      {
        path: '403',
        name: 'error-403',
        component: () => import('@/views/Errors/403.vue'),
      },
      {
        path: '404',
        name: 'error-404',
        component: () => import('@/views/Errors/404.vue'),
      },
      {
        path: '500',
        name: 'error-500',
        component: () => import('@/views/Errors/500.vue'),
      },
      {
        path: '503',
        name: 'error-503',
        component: () => import('@/views/Errors/503.vue'),
      },
    ],
  },
]
import { isLoggedIn } from '@/utils/auth'

const publicRoutes = ['/auth/sign-in', '/auth/sign-in-2', '/auth/sign-up', '/auth/forgot-password', '/auth/otp', '/errors/401', '/errors/403', '/errors/404', '/errors/500', '/errors/503']

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_APP_PUBLIC_PATH),
  routes: baseRoutes,
  scrollBehavior: (_, __, savedPosition) => {
    return savedPosition || { top: 0, left: 0 }
  },
})

// 全局前置守卫
router.beforeEach(async (to, _, next) => {
  // 检查当前路径是否在公共路由中 (或者是 auth 或者 errors 目录下的均放行)
  const isPublicRoute = publicRoutes.includes(to.path) || to.path.startsWith('/auth/') || to.path.startsWith('/errors/')

  if (!isPublicRoute && !isLoggedIn()) {
    // 还没登录且不属于公共路由，强制跳回登录
    next({
      path: '/auth/sign-in',
      query: { redirect: to.fullPath }, // 保存原目标路径，以便登录后重定向
    })
  } else if (to.path.startsWith('/auth/') && isLoggedIn()) {
    // 已经登录的情况下，又跑回登录页/认证页的话，重定向到首页
    next({ path: '/' })
  } else {
    // 正常放行
    next()
  }
})

// 清除路由和登出时重置路由状态
export const resetRouter = async () => {
  // TODO: 如果使用了动态路由，可以在这里执行清理逻辑
}

export default router
