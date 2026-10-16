import { createPinia, setActivePinia } from 'pinia'
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { useSystemTheme } from '@/composables/use-system-theme'
import { createPermissionDirective } from '@/directives/permission'
import Layout from '@/layouts/index.vue'
import { useAuthStore } from '@/store/auth'
import AISettings from '@/views/AISettings/index.vue'
import SignIn from '@/views/Auth/SignIn.vue'
import Dashboard from '@/views/Dashboard/index.vue'
import Languages from '@/views/Languages/index.vue'
import Projects from '@/views/Projects/index.vue'
import Workbench from '@/views/Workbench/index.vue'
import Logs from '@/views/Workbench/Logs.vue'
import '@/style.css'
import '@/assets/index.css'
import '@/assets/themes.css'
import '@/assets/scrollbar.css'
import 'vue-sonner/style.css'

const params = new URLSearchParams(location.search)
const languages = [
  { id: 1, code: 'zh', name: '简体中文', is_source: true, sort_order: 10, usage_count: 2 },
  { id: 2, code: 'en', name: '英语', sort_order: 20, usage_count: 2 },
  { id: 3, code: 'de', name: '德语', sort_order: 30, usage_count: 1 },
]
const projects = [
  { id: 1, name: 'Nexus 多语言中心', code: 'nexus-multilingual', description: '管理工作台、登录与项目协作中的界面文案。', languages, created_at: '2026-10-12', updated_at: '2026-10-14' },
  { id: 2, name: 'Helios 账户与访问管理', code: 'helios-auth', description: '统一登录、账户审批与项目授权相关文案。', languages: languages.slice(0, 2), created_at: '2026-10-12', updated_at: '2026-10-14' },
]
const items = [
  { id: 1, module: 'common', key: 'action.save', description: '编辑表单的保存按钮', status: 'pending', translations: [{ language_code: 'zh', content: '保存修改' }, { language_code: 'en', content: 'Save changes' }, { language_code: 'de', content: 'Änderungen speichern' }] },
  { id: 2, module: 'auth', key: 'login.welcome', description: '登录页面的欢迎文案', status: 'published', translations: [{ language_code: 'zh', content: '欢迎回来' }, { language_code: 'en', content: 'Welcome back' }, { language_code: 'de', content: 'Willkommen zurück' }] },
  { id: 3, module: 'projects', key: 'project.create', description: '创建新的翻译项目', status: 'review', translations: [{ language_code: 'zh', content: '新建项目' }, { language_code: 'en', content: 'Create project' }] },
]
let failReview = true
// Dev-only entry: all API traffic is intercepted, including writes. Never touches real data.
window.fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(raw, location.origin)
  const path = url.pathname
  const method = init?.method || (input instanceof Request ? input.method : 'GET')
  let data: unknown = {}
  if (params.has('loading'))
    await new Promise(resolve => setTimeout(resolve, 1200))
  if (params.has('error') && (path.endsWith('/projects') || path.endsWith('/dashboard')))
    return new Response(JSON.stringify({ code: 500, message: '模拟网络错误，请重新加载' }))
  if (path.endsWith('/auth/csrf')) {
    data = { csrf_token: 'fixture' }
  }
  else if (path.endsWith('/auth/me')) {
    data = { id: 'fixture', name: '测试管理员', role: 'admin' }
  }
  else if (path.endsWith('/projects')) {
    data = params.has('empty') ? [] : projects
  }
  else if (path.endsWith('/dashboard')) {
    data = {
      project: projects[0],
      stats: { total: 120, draft: 8, pending: 32, review: 16, published: 64, lang_coverage: {} },
      languages: languages.map((lang, i) => ({ ...lang, translated_count: 120 - i * 25, missing_count: i * 25, progress: 100 - i * 21 })),
      focus: { terms_ready_for_review: 16, terms_pending: 32, draft_terms: 8, published_terms: 64, recent_changes_24h: 24, stale_terms: 5 },
      recent_logs: [{ id: 1, action: '更新译文', created_at: '2026-10-14T08:00:00Z', term: { key: 'action.save', module: 'common' }, user: { nickname: '测试管理员' } }],
      activity_trend: [8, 14, 10, 22, 18, 32, 24].map((count, i) => ({ date: `2026-10-${8 + i}`, count })),
      last_activity_at: '2026-10-14T08:00:00Z',
    }
  }
  else if (path.includes('/languages')) {
    data = params.has('empty') ? [] : languages
  }
  else if (/\/projects\/\d+$/.test(path)) {
    data = projects[path.includes('/2') ? 1 : 0]
  }
  else if (path.includes('/terms') && method === 'GET') {
    data = {
      items: params.has('empty') || url.searchParams.get('q') === 'no-result' ? [] : items,
      total: 3,
      page: 1,
      page_size: 20,
      total_pages: 1,
      modules: ['common', 'auth', 'projects'],
      status_counts: { draft: 0, pending: 1, review: 1, published: 1 },
      project_summary: { total: 3, status_counts: { draft: 0, pending: 1, review: 1, published: 1 }, ready_review_count: 1 },
    }
  }
  else if (path.endsWith('/logs')) {
    data = [{ id: 1, user_id: 1, action: '更新译文', created_at: '2026-10-14T08:00:00Z', term: { key: 'action.save', module: 'common' }, user: { nickname: '测试管理员' } }]
  }
  else if (path.endsWith('/ai/settings')) {
    data = { configured: false, model: 'translation-model', relay_base_url: 'https://relay.example.test' }
  }
  else if (path.endsWith('/locale-release')) {
    data = null
  }
  else if (path.endsWith('/update') && failReview) {
    failReview = false
    return new Response(JSON.stringify({ code: 500, message: '模拟保存失败：保留输入后重试' }))
  }
  else if (method === 'POST') {
    data = { id: 3 }
  }
  return new Response(JSON.stringify({ code: 200, data, message: '' }), { headers: { 'Content-Type': 'application/json' } })
}

async function mountPreview() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 'fixture', name: '测试管理员', email: 'fixture@example.test', role: params.get('role') || 'admin' }
  auth.isLogin = true
  auth.initialized = true
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: Layout, children: [
      { path: 'dashboard', name: 'dashboard', component: Dashboard },
      { path: 'projects', name: 'projects', component: Projects },
      { path: 'workbench', name: 'workbench', component: Workbench },
      { path: 'languages', name: 'available-languages', component: Languages },
      { path: 'ai-settings', name: 'ai-settings', component: AISettings },
      { path: 'project-logs', name: 'project-logs', component: Logs },
    ] },
    { path: '/auth/sign-in', component: SignIn },
  ] })
  await router.push(params.get('page') || '/projects')
  createApp({
    setup() {
      useSystemTheme()
      return () => h('div', [h(RouterView), h(Toaster)])
    },
  })
    .use(pinia)
    .use(router)
    .directive('permission', createPermissionDirective(() => auth.user?.role))
    .mount('#app')
}
mountPreview().catch(console.error)
