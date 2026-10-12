import { createPinia, setActivePinia } from 'pinia'
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createPermissionDirective } from '@/directives/permission'
import { useAuthStore } from '@/store/auth'
import Workbench from '@/views/Workbench/index.vue'
import '@/style.css'

const project = (id: number) => ({ id, name: `回归项目 ${id}`, code: `regression-${id}`, description: '本地模拟数据', ai_prompt: '', created_at: '2026-10-12', updated_at: '2026-10-12' })
const languages = [{ code: 'zh', name: '中文', is_source: true }, { code: 'en', name: '英语' }]
const counts = { draft: 0, pending: 2, review: 0, published: 0 }
const items = [1, 2].map(id => ({ id, module: 'common', key: `key_${id}`, description: '用于本地回归测试', status: 'pending', translations: [{ language_code: 'zh', content: `原文 ${id}` }, { language_code: 'en', content: `Original ${id}` }] }))
let failNextReview = true

// This entry is served only by the dev server. Every API request is answered in memory.
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method || (input instanceof Request ? input.method : 'GET')
  let data: unknown = {}
  if (url.endsWith('/auth/csrf')) {
    data = { csrf_token: 'fixture' }
  }
  else if (url.endsWith('/auth/me')) {
    data = { id: 'fixture', role: 'admin' }
  }
  else if (url.endsWith('/projects')) {
    data = [project(1), project(2)]
  }
  else if (url.includes('/languages')) {
    data = languages
  }
  else if (/\/projects\/\d+(?:\?|$)/.test(url)) {
    data = project(url.includes('/2') ? 2 : 1)
  }
  else if (url.includes('/terms') && method === 'GET') {
    data = { items, total: 2, page: 1, page_size: 20, total_pages: 1, modules: ['common'], status_counts: counts, project_summary: { total: 2, status_counts: counts, ready_review_count: 2 } }
  }
  else if (url.includes('/ai/translate')) {
    data = { translations: { zh: 'AI 原文', en: 'AI translation' }, model: 'fixture', credential_source: 'personal' }
  }
  else if (url.endsWith('/update') && failNextReview) {
    failNextReview = false
    return new Response(JSON.stringify({ code: 500, message: '模拟服务器失败：可重试校对' }), { headers: { 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ code: 200, data, message: '' }), { headers: { 'Content-Type': 'application/json' } })
}

async function mountFixture() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 'fixture', role: 'admin' }
  auth.isLogin = true
  auth.initialized = true
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/workbench', component: Workbench }] })
  await router.push('/workbench?project=1')
  createApp({ render: () => h(RouterView) }).use(pinia).use(router).directive('permission', createPermissionDirective(() => auth.user?.role)).mount('#app')
}
mountFixture().catch(console.error)
