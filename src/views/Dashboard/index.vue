<script setup lang="ts">
import type { Project as I18nProject } from '@/types/domain'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileEdit,
  FolderKanban,
  Languages,
  RefreshCw,
  Wrench,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { getProjectDashboard, listProjects } from '@/api/projects'
import { useRequestScope } from '@/composables/use-request-scope'
import { errorMessage } from '@/lib/errors'
import { resolveSourceLanguage } from '@/lib/source-language'
import DashboardSkeleton from './DashboardSkeleton.vue'

defineOptions({ name: 'Dashboard' })

interface DashboardStats {
  total: number
  draft: number
  pending: number
  review: number
  published: number
  lang_coverage: Record<string, number>
}

interface DashboardLanguage {
  code: string
  name: string
  is_source: boolean
  translated_count: number
  missing_count: number
  progress: number
}

interface DashboardLog {
  id: number | string
  scope?: 'term' | 'project'
  action: string
  created_at: string
  item_count?: number
  term_keys?: string[]
  term?: {
    key: string
    module: string
  }
  user?: {
    nickname: string
    avatar_url: string
  }
}

interface DashboardTrendPoint {
  date: string
  count: number
}

interface DashboardFocus {
  terms_ready_for_review: number
  terms_pending: number
  draft_terms: number
  published_terms: number
  recent_changes_24h: number
  stale_terms: number
}

interface DashboardPayload {
  project: I18nProject
  stats: DashboardStats
  languages: DashboardLanguage[]
  recent_logs: DashboardLog[]
  activity_trend: DashboardTrendPoint[]
  focus: DashboardFocus
  last_activity_at: string | null
}

const router = useRouter()
const projects = ref<I18nProject[]>([])
const selectedProjectId = ref<number | null>(null)
const dashboardScope = useRequestScope(() => String(selectedProjectId.value || ''))
let dashboardRequest = 0
const dashboard = ref<DashboardPayload | null>(null)
const loadingProjects = ref(true)
const loadingDashboard = ref(false)
const projectLoadError = ref('')
const dashboardError = ref('')

const isLoading = computed(() => loadingProjects.value || loadingDashboard.value)
const currentProject = computed(() => dashboard.value?.project ?? projects.value.find(project => project.id === selectedProjectId.value) ?? null)
const stats = computed(() => dashboard.value?.stats ?? null)
const focus = computed(() => dashboard.value?.focus ?? null)
const languageCoverage = computed(() => dashboard.value?.languages ?? [])
const recentLogs = computed(() => dashboard.value?.recent_logs ?? [])
const activityTrend = computed(() => dashboard.value?.activity_trend ?? [])

const sourceLanguage = computed(() => resolveSourceLanguage(languageCoverage.value) ?? null)
const targetLanguageCount = computed(() => languageCoverage.value.length - (sourceLanguage.value ? 1 : 0))
const publishedRate = computed(() => {
  if (!stats.value?.total)
    return 0
  return Math.round((stats.value.published / stats.value.total) * 100)
})

const sortedLanguages = computed(() => {
  return [...languageCoverage.value].sort((a, b) => {
    const sourceCode = sourceLanguage.value?.code
    if ((a.code === sourceCode) !== (b.code === sourceCode))
      return a.code === sourceCode ? -1 : 1
    return a.progress - b.progress
  })
})

const topAttentionLanguages = computed(() => {
  return sortedLanguages.value
    .filter(language => language.code !== sourceLanguage.value?.code && language.missing_count > 0)
    .slice(0, 3)
})

const maxTrendCount = computed(() => Math.max(...activityTrend.value.map(point => point.count), 1))

const statCards = computed(() => {
  const currentStats = stats.value
  if (!currentStats)
    return []

  return [
    {
      label: '已发布',
      value: currentStats.published,
      hint: `${publishedRate.value}% 已完成`,
      icon: CheckCircle2,
      tone: 'detail-text',
      accent: 'success',
    },
    {
      label: '待校对',
      value: currentStats.review,
      hint: `${focus.value?.terms_ready_for_review ?? 0} 条可处理`,
      icon: AlertCircle,
      tone: 'detail-text',
      accent: 'info',
    },
    {
      label: '待翻译',
      value: currentStats.pending,
      hint: `${focus.value?.terms_pending ?? 0} 条进行中`,
      icon: Clock3,
      tone: 'detail-text',
      accent: 'warning',
    },
    {
      label: '草稿',
      value: currentStats.draft,
      hint: `${focus.value?.draft_terms ?? 0} 条待补充`,
      icon: FileEdit,
      tone: 'detail-text',
      accent: 'violet',
    },
  ]
})

async function loadProjects() {
  loadingProjects.value = true
  projectLoadError.value = ''
  try {
    const res = await listProjects<I18nProject[]>()
    projects.value = res.data ?? []
    const savedProjectId = Number(localStorage.getItem('dashboard_project_id') || '')
    const defaultProject = projects.value.find(project => project.id === savedProjectId) ?? projects.value[0] ?? null

    if (defaultProject) {
      selectedProjectId.value = defaultProject.id
      await loadDashboard()
    }
  }
  catch (error: unknown) {
    projectLoadError.value = errorMessage(error, '无法获取项目列表，请重试。')
    toast.error('加载项目失败', { description: projectLoadError.value })
  }
  finally {
    loadingProjects.value = false
  }
}

async function loadDashboard() {
  if (!selectedProjectId.value)
    return

  const ticket = dashboardScope.request()
  const requestId = ++dashboardRequest
  loadingDashboard.value = true
  dashboardError.value = ''
  try {
    const res = await getProjectDashboard<DashboardPayload>(ticket.context, { signal: ticket.signal })
    if (!ticket.isCurrent() || requestId !== dashboardRequest)
      return
    dashboard.value = res.data
    localStorage.setItem('dashboard_project_id', String(selectedProjectId.value))
  }
  catch (error: unknown) {
    if (ticket.isCurrent() && requestId === dashboardRequest) {
      dashboardError.value = errorMessage(error, '无法获取项目总览，请重试。')
      toast.error('加载项目总览失败', { description: dashboardError.value })
    }
  }
  finally {
    ticket.release()
    if (ticket.isCurrent() && requestId === dashboardRequest)
      loadingDashboard.value = false
  }
}

async function switchProject(id: number) {
  if (selectedProjectId.value === id && dashboard.value)
    return

  dashboardScope.invalidate()
  dashboard.value = null
  selectedProjectId.value = id
  await loadDashboard()
}

function goWorkbench() {
  if (!selectedProjectId.value)
    return
  router.push({ path: '/workbench', query: { project: selectedProjectId.value } })
}

function goLogs() {
  if (!selectedProjectId.value)
    return
  router.push({ path: '/project-logs', query: { project: selectedProjectId.value } })
}

function formatRelativeTime(value?: string | null) {
  if (!value)
    return '暂无记录'
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1)
    return '刚刚'
  if (minutes < 60)
    return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)
    return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function formatDate(value?: string | null) {
  if (!value)
    return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const trendCoordinates = computed(() => activityTrend.value.map((point, index, points) => ({
  ...point,
  x: points.length === 1 ? 300 : 40 + index * 520 / (points.length - 1),
  y: 170 - point.count / maxTrendCount.value * 140,
})))
const trendLine = computed(() => trendCoordinates.value.map(point => `${point.x},${point.y}`).join(' '))
const trendArea = computed(() => {
  const points = trendCoordinates.value
  if (!points.length)
    return ''
  return `${points[0]!.x},170 ${trendLine.value} ${points[points.length - 1]!.x},170`
})
const trendTotal = computed(() => activityTrend.value.reduce((total, point) => total + point.count, 0))

onMounted(loadProjects)
</script>

<template>
  <div class="workspace-page space-y-5">
    <header class="page-heading">
      <div>
        <h1>项目总览</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          翻译进度、待办与团队动态，集中掌握。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UiButton variant="outline" size="icon" aria-label="刷新项目总览" :disabled="isLoading || !selectedProjectId" @click="loadDashboard">
          <RefreshCw class="size-4" :class="isLoading ? 'animate-spin' : ''" />
        </UiButton>
        <UiButton :disabled="!selectedProjectId" @click="goWorkbench">
          <Wrench class="size-4" />进入工作台
        </UiButton>
      </div>
    </header>

    <DashboardSkeleton v-if="loadingProjects" show-project-list />
    <section v-else-if="projectLoadError" class="workspace-panel flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
      <AlertCircle class="size-6 text-destructive" />
      <h2 class="font-semibold">
        项目列表加载失败
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ projectLoadError }}
      </p>
      <UiButton variant="outline" @click="loadProjects">
        重新加载
      </UiButton>
    </section>
    <section v-else-if="projects.length === 0" class="workspace-panel p-10 text-center">
      <FolderKanban class="mx-auto mb-4 size-10 text-muted-foreground" />
      <h2 class="text-lg font-semibold">
        还没有翻译项目
      </h2>
      <p class="mt-2 text-sm text-muted-foreground">
        先创建项目，再查看整体翻译进度。
      </p>
      <UiButton class="mt-5" @click="router.push('/projects')">
        前往项目管理
      </UiButton>
    </section>
    <template v-else>
      <div class="flex flex-wrap gap-2" aria-label="选择总览项目">
        <button
          v-for="project in projects" :key="project.id" class="rounded-md border px-3 py-2 text-sm transition-colors"
          :aria-pressed="selectedProjectId === project.id"
          :class="selectedProjectId === project.id ? 'border-primary/30 bg-accent font-medium text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'"
          @click="switchProject(project.id)"
        >
          {{ project.name }}
        </button>
      </div>
      <UiAlert v-if="dashboardError" variant="destructive" role="alert">
        <AlertCircle /><UiAlertTitle>项目总览加载失败</UiAlertTitle>
        <UiAlertDescription>
          {{ dashboardError }}<UiButton variant="outline" size="sm" :disabled="loadingDashboard" @click="loadDashboard">
            重新加载
          </UiButton>
        </UiAlertDescription>
      </UiAlert>
      <DashboardSkeleton v-if="loadingDashboard && !dashboard" />
      <template v-else-if="dashboard && currentProject && stats && focus">
        <section class="dashboard-context flex flex-wrap items-center justify-between gap-4" aria-label="当前项目">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><FolderKanban class="size-5" /></span>
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold" :title="currentProject.name">
                {{ currentProject.name }}
              </h2>
              <p class="mt-1 truncate text-xs text-muted-foreground" :title="currentProject.description">
                {{ currentProject.description || currentProject.code }}
              </p>
            </div>
          </div>
          <span class="text-xs text-muted-foreground">最近活跃 · {{ formatRelativeTime(dashboard.last_activity_at) }}</span>
        </section>

        <div class="dashboard-metrics" aria-label="项目指标" :aria-busy="loadingDashboard">
          <article class="workspace-panel p-4">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderKanban class="size-4 text-primary" />词条总量
            </div>
            <p class="metric-value mt-3">
              {{ stats.total.toLocaleString('zh-CN') }}<span class="ml-1 text-xs font-normal text-muted-foreground">条</span>
            </p>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ targetLanguageCount }} 个目标语种
            </p>
          </article>
          <article v-for="card in statCards" :key="card.label" :data-tone="card.accent" class="workspace-panel p-4">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <component :is="card.icon" class="detail-text size-4" />{{ card.label }}
            </div>
            <p class="metric-value mt-3">
              {{ card.value.toLocaleString('zh-CN') }}<span class="ml-1 text-xs font-normal text-muted-foreground">条</span>
            </p>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ card.hint }}
            </p>
          </article>
          <article class="workspace-panel p-4">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Languages class="size-4 text-primary" />发布率
            </div>
            <p class="metric-value mt-3">
              {{ publishedRate }}<span class="ml-1 text-sm font-normal text-muted-foreground">%</span>
            </p>
            <p class="mt-2 text-xs text-muted-foreground">
              源语言 · {{ sourceLanguage?.name || '未设置' }}
            </p>
          </article>
        </div>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section class="workspace-panel min-w-0 p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold">
                  最近 7 天活跃度
                </h3><p class="mt-1 text-xs text-muted-foreground">
                  按操作日志统计，每日变更次数
                </p>
              </div>
              <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><span class="size-2 rounded-full bg-primary" />操作次数 · 合计 {{ trendTotal }}</span>
            </div>
            <div v-if="!activityTrend.length" class="flex h-60 items-center justify-center text-sm text-muted-foreground">
              暂无活跃记录
            </div>
            <template v-else>
              <svg viewBox="0 0 600 205" class="mt-5 h-52 w-full" role="img" aria-label="最近七天每日操作次数趋势，下方提供每日数值">
                <defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--primary)" stop-opacity="0.15" /><stop offset="100%" stop-color="var(--primary)" stop-opacity="0.01" /></linearGradient></defs>
                <g v-for="tick in [0, 0.5, 1]" :key="tick">
                  <line x1="40" x2="560" :y1="170 - tick * 140" :y2="170 - tick * 140" stroke="var(--border)" stroke-dasharray="3 4" />
                  <text x="28" :y="174 - tick * 140" text-anchor="end" fill="var(--muted-foreground)" font-size="12">{{ Math.round(tick * maxTrendCount) }}</text>
                </g>
                <polygon :points="trendArea" fill="url(#activity-fill)" />
                <polyline :points="trendLine" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" />
                <g v-for="point in trendCoordinates" :key="point.date">
                  <circle :cx="point.x" :cy="point.y" r="3" fill="var(--card)" stroke="var(--primary)" stroke-width="2" />
                  <text :x="point.x" y="198" text-anchor="middle" fill="var(--muted-foreground)" font-size="12">{{ point.date.slice(5) }}</text>
                </g>
              </svg>
              <details class="mt-1 text-xs text-muted-foreground">
                <summary class="w-fit cursor-pointer rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                  查看每日数据
                </summary>
                <dl class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div v-for="point in activityTrend" :key="point.date">
                    <dt>{{ point.date }}</dt><dd class="mt-1 font-medium text-foreground">
                      {{ point.count }} 次
                    </dd>
                  </div>
                </dl>
              </details>
            </template>
          </section>

          <section class="workspace-panel p-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">
                流程分布
              </h3><Activity class="size-4 text-muted-foreground" />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              从草稿到发布，查看当前词条状态。
            </p>
            <div class="mt-6 space-y-5">
              <div v-for="card in statCards" :key="card.label" :data-tone="card.accent">
                <div class="mb-2 flex items-center justify-between text-xs">
                  <span>{{ card.label }}</span><span class="tabular-nums text-muted-foreground">{{ card.value }} / {{ stats.total }}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-muted">
                  <div class="detail-progress h-full rounded-full" :style="{ width: `${stats.total ? card.value / stats.total * 100 : 0}%` }" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section class="workspace-panel min-w-0 p-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">
                语种完成情况
              </h3><span class="text-xs text-muted-foreground">共 {{ languageCoverage.length }} 个语种</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              目标语种按完成率排序，优先补齐缺失译文。
            </p>
            <p v-if="!sortedLanguages.length" class="py-10 text-center text-sm text-muted-foreground">
              当前项目还没有配置语言。
            </p>
            <div v-else class="mt-4 max-h-96 divide-y overflow-y-auto pr-1 [scrollbar-gutter:stable]" tabindex="0" aria-label="语种完成情况列表">
              <article v-for="language in sortedLanguages" :key="language.code" class="py-4">
                <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="font-medium">{{ language.name }}</span><span class="font-mono text-xs text-muted-foreground">{{ language.code }}</span><span v-if="language.code === sourceLanguage?.code" class="rounded-sm bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">源语言</span>
                  </div>
                  <span class="tabular-nums text-muted-foreground"><strong class="font-semibold text-foreground">{{ language.progress }}%</strong> · {{ language.translated_count }} / {{ stats.total }}</span>
                </div>
                <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div class="h-full rounded-full bg-primary" :style="{ width: `${language.progress}%` }" />
                </div>
              </article>
            </div>
          </section>
          <section class="workspace-panel p-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">
                当前待办
              </h3><AlertCircle class="size-4 text-muted-foreground" />
            </div>
            <div class="mt-4 divide-y">
              <div class="flex items-center justify-between gap-4 py-3">
                <div>
                  <p class="text-sm font-medium">
                    优先校对
                  </p><p class="mt-1 text-xs text-muted-foreground">
                    译文已补全，可以进入校对
                  </p>
                </div><strong class="text-xl font-semibold tabular-nums text-primary">{{ focus.terms_ready_for_review }}</strong>
              </div>
              <div class="flex items-center justify-between gap-4 py-3">
                <div>
                  <p class="text-sm font-medium">
                    近期变更
                  </p><p class="mt-1 text-xs text-muted-foreground">
                    最近 24 小时的操作次数
                  </p>
                </div><strong class="text-xl font-semibold tabular-nums">{{ focus.recent_changes_24h }}</strong>
              </div>
              <div class="flex items-center justify-between gap-4 py-3">
                <div>
                  <p class="text-sm font-medium">
                    长期未更新
                  </p><p class="mt-1 text-xs text-muted-foreground">
                    检查是否仍有未完成内容
                  </p>
                </div><strong class="text-xl font-semibold tabular-nums">{{ focus.stale_terms }}</strong>
              </div>
            </div>
            <p v-if="topAttentionLanguages.length" class="mt-3 text-xs leading-5 text-muted-foreground">
              优先关注：{{ topAttentionLanguages.map(language => `${language.name}（缺 ${language.missing_count} 条）`).join('、') }}
            </p>
            <p v-else class="mt-3 text-xs text-muted-foreground">
              暂无需要补齐译文的目标语种。
            </p>
            <UiButton variant="outline" class="mt-4 w-full" @click="goWorkbench">
              继续处理词条<ArrowRight class="size-4" />
            </UiButton>
          </section>
        </div>

        <section class="workspace-panel p-5">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold">
              最近动态
            </h3><UiButton v-permission="'logs.view'" variant="ghost" size="sm" @click="goLogs">
              查看全部<ArrowRight class="size-3.5" />
            </UiButton>
          </div>
          <p v-if="!recentLogs.length" class="py-10 text-center text-sm text-muted-foreground">
            暂无动态记录。
          </p>
          <div v-else class="mt-2 divide-y">
            <article v-for="log in recentLogs" :key="log.id" class="flex items-start gap-3 py-4">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Clock3 class="size-4" /></span>
              <div class="min-w-0 flex-1">
                <p class="break-words text-sm leading-6">
                  <span class="font-medium">{{ log.user?.nickname || '系统' }}</span><span class="mx-2 text-muted-foreground">{{ log.scope === 'project' ? `批量创建了 ${log.item_count || 1} 个词条` : log.action }}</span><span class="font-mono text-xs">{{ log.scope === 'project' ? log.term_keys?.slice(0, 3).join('、') || '批量词条' : log.term?.key || '未知词条' }}</span>
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ formatDate(log.created_at) }}
                </p>
              </div>
            </article>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
