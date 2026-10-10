import type { PermissionRequirement } from '@/lib/permissions'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import NavTeam from '@/components/app-sidebar/nav-team.vue'
import { Button } from '@/components/ui/button'
import { SidebarProvider } from '@/components/ui/sidebar'
import { createPermissionDirective } from '@/directives/permission'
import { hasPermission, hasRoutePermission, PERMISSIONS, ROLES } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth'
import Projects from '@/views/Projects/index.vue'
import Workbench from '@/views/Workbench/index.vue'

const checks: string[] = []
const check = (condition: unknown, label: string) => {
  if (!condition)
    throw new Error(label)
  checks.push(`PASS ${label}`)
}

const run = async () => {
  const roles = Object.values(ROLES)
  for (const role of roles) {
    for (const [permission, allowed] of Object.entries(PERMISSIONS)) {
      check(hasPermission(role, permission as keyof typeof PERMISSIONS) === (allowed as readonly string[]).includes(role), `${role}: ${permission}`)
    }
  }
  check(!hasPermission('unknown', 'term.edit'), '未知角色拒绝访问')
  check(!hasPermission(null, 'term.edit'), '未登录拒绝访问')
  check(!hasPermission('admin', []), '空权限列表拒绝访问')
  check(!hasPermission('admin', 'missing' as PermissionRequirement), '未知权限拒绝访问')
  check(hasPermission('owner', 'ai.settings'), '兼容 owner 管理员')
  check(hasPermission('developer', ['term.review', 'term.create']), '数组任一匹配')
  check(!hasPermission('developer', ['term.review', 'term.create'], true), 'all 要求全部匹配')
  for (const role of [null, '', 'user', 'unknown', ...roles]) {
    for (const path of ['/dashboard', '/projects', '/workbench', '/languages'])
      check(hasRoutePermission(role, path), `${role ?? '未加载'}: 基础导航 ${path} 保留`)
    check(hasRoutePermission(role, '/ai-settings') === hasPermission(role, 'ai.settings'), `${role ?? '未加载'}: AI 设置导航按明确权限控制`)
  }

  const role = ref<string | null>(null)
  const requirement = ref<PermissionRequirement>('term.review')
  const styled = ref(false)
  const show = ref(true)
  const clicks = ref(0)
  const directive = createPermissionDirective(() => role.value)
  const app = createApp(defineComponent({
    setup: () => () => show.value
      ? h('div', [
          withDirectives(h('button', {
            id: 'native',
            style: { display: styled.value ? 'inline-flex' : 'inline-block' },
            onClick: () => clicks.value++,
          }, '原生按钮'), [[directive, requirement.value]]),
          withDirectives(h(Button, { id: 'component', onClick: () => clicks.value++ }, () => '组件按钮'), [[directive, ['term.review', 'term.create'], undefined, { all: true }]]),
        ])
      : null,
  }))
  app.mount('#fixture')
  const button = () => document.querySelector<HTMLButtonElement>('#native')!
  const component = () => document.querySelector<HTMLButtonElement>('#component')!
  check(getComputedStyle(button()).display === 'none', '首次挂载无权限立即隐藏')
  button().click()
  check(clicks.value === 0, '拒绝权限时阻止合成点击')
  role.value = 'admin'
  await nextTick()
  check(getComputedStyle(button()).display === 'inline-block', '角色变化恢复原有 display')
  check(getComputedStyle(component()).display !== 'none', '单根 Vue 组件及 all 指令生效')
  button().click()
  check(clicks.value === 1, '授权点击正常执行')
  role.value = 'developer'
  await nextTick()
  check(getComputedStyle(button()).display === 'none', '角色降权立即隐藏')
  check(getComputedStyle(component()).display === 'none', '组件 all 权限在降权后隐藏')
  styled.value = true
  await nextTick()
  check(getComputedStyle(button()).display === 'none', '样式更新不能覆盖权限隐藏')
  requirement.value = 'term.create'
  await nextTick()
  check(getComputedStyle(button()).display !== 'none', '绑定权限变化重新授权')
  role.value = null
  await nextTick()
  check(getComputedStyle(button()).display === 'none', '退出登录后隐藏')
  show.value = false
  await nextTick()
  role.value = 'admin'
  await nextTick()
  check(!document.querySelector('#native'), '卸载后监听清理')
  app.unmount()

  // 使用真实项目列表页面，所有 API 都由本地 fixture 替代，不发送网络请求。
  const originalFetch = window.fetch
  window.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const project = { id: 1, name: '权限测试项目', code: 'permission-test', description: '本地测试', created_at: '2026-10-10', updated_at: '2026-10-10', languages: [{ code: 'zh', name: '中文' }] }
    const counts = { draft: 0, pending: 1, review: 0, published: 0 }
    let data: unknown = [project]
    if (url.includes('/languages'))
      data = [{ code: 'zh', name: '中文', is_source: true }, { code: 'en', name: '英语' }]
    else if (url.includes('/terms'))
      data = { items: [{ id: 1, key: 'hello', module: 'common', description: '测试上下文', status: 'pending', translations: [{ language_code: 'zh', content: '你好' }, { language_code: 'en', content: 'Hello' }] }], total: 1, page: 1, total_pages: 1, modules: ['common'], status_counts: counts, project_summary: { total: 1, status_counts: counts, ready_review_count: 1 } }
    else if (/\/projects\/1(?:\?|$)/.test(url))
      data = project
    return new Response(JSON.stringify({ code: 200, data }), { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/projects', component: Projects }] })
    await router.push('/projects')
    const menus = [
      { title: '项目总览', url: '/dashboard' },
      { title: '项目管理', url: '/projects' },
      { title: '多语言工作台', url: '/workbench' },
      { title: 'AI 翻译设置', url: '/ai-settings' },
      { title: '可选语言', url: '/languages' },
    ]
    const sidebarApp = createApp({ render: () => h(SidebarProvider, null, { default: () => h(NavTeam, { navMain: [{ title: '工作空间', items: menus }] }) }) })
    sidebarApp.use(pinia).use(router)
    sidebarApp.mount('#fixture')
    for (const role of [null, '', 'user', 'unknown', ...roles]) {
      auth.user = role === null ? null : { role }
      await nextTick()
      for (const menu of menus) {
        const link = document.querySelector(`#fixture a[href="${menu.url}"]`)
        check(Boolean(link) === hasRoutePermission(role, menu.url), `${role ?? '未加载'}: 真实侧栏 ${menu.title}`)
      }
    }
    sidebarApp.unmount()
    const projectApp = createApp(Projects)
    projectApp.use(pinia).use(router).directive('permission', createPermissionDirective(() => auth.user?.role))
    projectApp.mount('#fixture')
    await new Promise(resolve => setTimeout(resolve, 100))
    for (const role of roles) {
      auth.user = { role }
      await nextTick()
      const create = [...document.querySelectorAll('button')].find(el => el.textContent?.includes('新建项目'))!
      const edit = document.querySelector<HTMLButtonElement>('[aria-label="编辑权限测试项目"]')!
      const remove = document.querySelector<HTMLButtonElement>('[aria-label="删除权限测试项目"]')!
      check(Boolean(create && edit && remove), `${role}: 项目页面入口渲染`)
      check((getComputedStyle(create).display !== 'none') === hasPermission(role, 'project.create'), `${role}: 项目创建入口`)
      check((getComputedStyle(edit).display !== 'none') === hasPermission(role, 'project.edit'), `${role}: 项目编辑入口`)
      check((getComputedStyle(remove).display !== 'none') === hasPermission(role, 'project.delete'), `${role}: 项目删除入口`)
    }
    projectApp.unmount()

    await router.push('/projects?project=1')
    const workbenchApp = createApp(Workbench)
    workbenchApp.use(pinia).use(router).directive('permission', createPermissionDirective(() => auth.user?.role))
    workbenchApp.mount('#fixture')
    await new Promise(resolve => setTimeout(resolve, 300))
    document.querySelector<HTMLButtonElement>('tbody button[role="checkbox"]')!.click()
    await nextTick()
    for (const role of roles) {
      auth.user = { role }
      await nextTick()
      for (const [label, permission] of [
        ['新建词条', 'term.create'],
        ['AI 批量翻译', 'term.translate'],
        ['批量校对通过', 'term.review'],
        ['批量发布', 'term.publish'],
        ['批量删除', 'term.delete'],
      ] as const) {
        const button = [...document.querySelectorAll('button')].find(el => el.textContent?.includes(label))!
        check(Boolean(button), `${role}: 工作台 ${label} 入口渲染`)
        check(button.checkVisibility() === hasPermission(role, permission), `${role}: 工作台 ${label} 权限`)
      }
    }
    // Reka 下拉菜单内容通过 Portal 挂载，验证指令在传送后的真实菜单项上生效。
    const tools = document.querySelector<HTMLButtonElement>('[aria-label="打开工作台工具箱"]')!
    tools.click()
    await new Promise(resolve => setTimeout(resolve, 100))
    for (const role of roles) {
      auth.user = { role }
      await nextTick()
      const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(el => el.textContent?.includes('导入多语言 JSON'))!
      check(Boolean(item), `${role}: Portal 菜单渲染`)
      check(item.checkVisibility() === hasPermission(role, 'term.import'), `${role}: Portal 导入菜单权限`)
    }
    workbenchApp.unmount()
  }
  finally {
    window.fetch = originalFetch
  }
  document.querySelector('#result')!.textContent = `${checks.length} checks passed\n${checks.join('\n')}`
}

run().catch((error) => {
  document.querySelector('#result')!.textContent = `FAILED: ${error.message}\n${checks.join('\n')}`
  console.error(error)
})
