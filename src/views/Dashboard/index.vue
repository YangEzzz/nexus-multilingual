<script setup lang="ts">
import type { Project as I18nProject } from '@/types/domain'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDotDashed,
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

const sourceLanguage = computed(() => languageCoverage.value.find(language => language.is_source) ?? null)
const targetLanguageCount = computed(() => Math.max(languageCoverage.value.filter(language => !language.is_source).length, 0))
const publishedRate = computed(() => {
  if (!stats.value?.total)
    return 0
  return Math.round((stats.value.published / stats.value.total) * 100)
})

const sortedLanguages = computed(() => {
  return [...languageCoverage.value].sort((a, b) => {
    if (a.is_source !== b.is_source)
      return a.is_source ? -1 : 1
    return a.progress - b.progress
  })
})

const topAttentionLanguages = computed(() => {
  return sortedLanguages.value
    .filter(language => !language.is_source)
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
      bg: 'bg-muted/30',
      border: 'border-border',
    },
    {
      label: '待校对',
      value: currentStats.review,
      hint: `${focus.value?.terms_ready_for_review ?? 0} 条可处理`,
      icon: AlertCircle,
      tone: 'detail-text',
      accent: 'info',
      bg: 'bg-muted/30',
      border: 'border-border',
    },
    {
      label: '待翻译',
      value: currentStats.pending,
      hint: `${focus.value?.terms_pending ?? 0} 条进行中`,
      icon: Clock3,
      tone: 'detail-text',
      accent: 'warning',
      bg: 'bg-muted/30',
      border: 'border-border',
    },
    {
      label: '草稿',
      value: currentStats.draft,
      hint: `${focus.value?.draft_terms ?? 0} 条待补充`,
      icon: FileEdit,
      tone: 'detail-text',
      accent: 'violet',
      bg: 'bg-muted/30',
      border: 'border-border',
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

function trendBarHeight(point: DashboardTrendPoint) {
  return `${Math.max(Math.round((point.count / maxTrendCount.value) * 100), point.count > 0 ? 18 : 8)}%`
}

onMounted(loadProjects)
</script>

<template>
  <div class="workspace-page min-h-0 space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">
          项目总览
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          聚焦当前项目的翻译进度、阻塞点和最近动态。
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UiButton variant="outline" size="icon" aria-label="刷新项目总览" :disabled="isLoading" @click="loadDashboard">
          <RefreshCw class="size-4" :class="isLoading ? 'animate-spin' : ''" />
        </UiButton>
        <UiButton :disabled="!selectedProjectId" @click="goWorkbench">
          <Wrench class="mr-2 size-4" />
          进入工作台
        </UiButton>
      </div>
    </div>

    <DashboardSkeleton v-if="loadingProjects" show-project-list />

    <section v-else-if="projectLoadError" class="workspace-panel flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
      <AlertCircle class="size-6 text-destructive" /><h2 class="font-semibold">
        项目列表加载失败
      </h2><p class="text-sm text-muted-foreground">
        {{ projectLoadError }}
      </p>
      <UiButton variant="outline" @click="loadProjects">
        重新加载
      </UiButton>
    </section>

    <div v-else-if="projects.length === 0" class="rounded-xl border border-dashed bg-card/70 p-10 text-center">
      <FolderKanban class="mx-auto mb-4 size-10 text-muted-foreground/60" />
      <h2 class="text-lg font-semibold">
        还没有翻译项目
      </h2>
      <p class="mt-2 text-sm text-muted-foreground">
        先创建项目，再回来查看整体进度与翻译健康度。
      </p>
      <UiButton class="mt-5" @click="router.push('/projects')">
        前往项目管理
      </UiButton>
    </div>

    <template v-else>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="project in projects"
          :key="project.id"
          class="rounded-lg border px-4 py-2 text-sm transition-colors"
          :aria-pressed="selectedProjectId === project.id"
          :class="selectedProjectId === project.id
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'"
          @click="switchProject(project.id)"
        >
          {{ project.name }}
        </button>
      </div>

      <UiAlert v-if="dashboardError" variant="destructive" role="alert">
        <AlertCircle /><UiAlertTitle>项目总览加载失败</UiAlertTitle><UiAlertDescription>
          {{ dashboardError }} <UiButton variant="outline" size="sm" :disabled="loadingDashboard" @click="loadDashboard">
            重新加载
          </UiButton>
        </UiAlertDescription>
      </UiAlert>
      <DashboardSkeleton v-if="loadingDashboard && !dashboard" />

      <template v-else-if="dashboard && currentProject && stats && focus">
        <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section class="overflow-hidden rounded-xl border border-border bg-card">
            <div class="flex h-full flex-col gap-6 p-6">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="space-y-2">
                  <div data-tone="info" class="detail-badge inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs">
                    <FolderKanban class="size-3.5" />
                    当前项目
                  </div>
                  <div>
                    <h2 class="text-2xl font-semibold tracking-tight">
                      {{ currentProject.name }}
                    </h2>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">
                      {{ currentProject.code }}
                    </p>
                  </div>
                  <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {{ currentProject.description || '这个项目还没有补充描述，可以在项目管理中完善背景说明与命名规范。' }}
                  </p>
                </div>

                <div class="grid gap-2 text-sm text-muted-foreground">
                  <div class="rounded-xl border bg-background/70 px-4 py-3">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                      最近活跃
                    </div>
                    <div class="mt-1 font-medium text-foreground">
                      {{ formatRelativeTime(dashboard.last_activity_at) }}
                    </div>
                  </div>
                  <div class="rounded-xl border bg-background/70 px-4 py-3">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                      最近更新
                    </div>
                    <div class="mt-1 font-medium text-foreground">
                      {{ formatDate(currentProject.updated_at) }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="metric-strip">
                <div class="min-w-0">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    词条总量
                  </div>
                  <div class="mt-2 text-3xl font-semibold">
                    {{ stats.total }}
                  </div>
                </div>
                <div class="min-w-0">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    目标语种
                  </div>
                  <div class="mt-2 text-3xl font-semibold">
                    {{ targetLanguageCount }}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    源语言：{{ sourceLanguage?.name || '未设置' }}
                  </div>
                </div>
                <div class="min-w-0">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    整体发布率
                  </div>
                  <div class="mt-2 text-3xl font-semibold">
                    {{ publishedRate }}%
                  </div>
                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
                    <div data-tone="success" class="detail-progress h-full rounded-full transition-all" :style="{ width: `${publishedRate}%` }" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-xl border bg-card p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">
                  当前关注点
                </h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  优先处理可校对词条，再补齐缺失译文。
                </p>
              </div>
              <CircleDotDashed class="size-4 text-muted-foreground" />
            </div>

            <div class="mt-5 space-y-3">
              <div class="flex items-start justify-between rounded-xl border border-border bg-muted p-4 dark:border-border dark:bg-muted">
                <div>
                  <div class="text-sm font-medium text-foreground dark:text-foreground">
                    优先校对
                  </div>
                  <p class="mt-1 text-xs text-foreground dark:text-foreground">
                    已补全翻译、可以校对通过的词条
                  </p>
                </div>
                <div class="text-2xl font-semibold text-foreground dark:text-foreground">
                  {{ focus.terms_ready_for_review }}
                </div>
              </div>

              <div class="flex items-start justify-between rounded-xl border border-border bg-muted p-4 dark:border-border dark:bg-muted">
                <div>
                  <div class="text-sm font-medium text-foreground dark:text-foreground">
                    翻译进行中
                  </div>
                  <p class="mt-1 text-xs text-foreground dark:text-foreground">
                    仍有语种缺口，需要继续补齐
                  </p>
                </div>
                <div class="text-2xl font-semibold text-foreground dark:text-foreground">
                  {{ focus.terms_pending }}
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    24h 变更
                  </div>
                  <div class="mt-2 text-2xl font-semibold">
                    {{ focus.recent_changes_24h }}
                  </div>
                </div>
                <div class="rounded-xl border p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    超过 7 天未完成
                  </div>
                  <div class="mt-2 text-2xl font-semibold">
                    {{ focus.stale_terms }}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section class="rounded-xl border bg-card p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">
                  流程状态
                </h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  从草稿到发布，当前积压一眼看清。
                </p>
              </div>
              <Activity class="size-4 text-muted-foreground" />
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article
                v-for="card in statCards"
                :key="card.label"
                :data-tone="card.accent"
                class="rounded-xl border bg-muted/30 p-4"
                :class="[card.border, card.bg]"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium" :class="card.tone">{{ card.label }}</span>
                  <component :is="card.icon" class="size-4" :class="card.tone" />
                </div>
                <div class="mt-4 text-3xl font-semibold">
                  {{ card.value }}
                </div>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ card.hint }}
                </p>
              </article>
            </div>
          </section>

          <section class="rounded-xl border bg-card p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">
                  最近 7 天活跃度
                </h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  根据日志条数观察项目活跃程度。
                </p>
              </div>
              <span class="text-xs text-muted-foreground">最近一周</span>
            </div>

            <div class="mt-6 flex h-44 items-end gap-3">
              <div
                v-for="point in activityTrend"
                :key="point.date"
                class="flex flex-1 flex-col items-center gap-2"
              >
                <div class="flex h-full w-full items-end">
                  <div
                    class="w-full rounded-t-xl bg-primary/75 transition-all"
                    :style="{ height: trendBarHeight(point) }"
                  />
                </div>
                <div class="text-center text-[11px] text-muted-foreground">
                  {{ point.date.slice(5).replace('-', '/') }}
                </div>
                <div class="text-[11px] font-medium text-foreground">
                  {{ point.count }}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
          <section class="flex min-h-0 flex-col rounded-xl border bg-card p-6 shadow-sm xl:h-[44rem]">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">
                  语种健康度
                </h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  优先把落后的语言包补齐，避免后续集中返工。
                </p>
              </div>
              <div class="text-xs text-muted-foreground">
                共 {{ languageCoverage.length }} 个语种
              </div>
            </div>

            <div v-if="sortedLanguages.length === 0" class="mt-8 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              当前项目还没有配置语言。
            </div>

            <div v-else class="mt-5 min-h-0 flex-1 overflow-hidden">
              <div class="h-full space-y-4 overflow-y-auto pr-2">
                <article
                  v-for="language in sortedLanguages"
                  :key="language.code"
                  class="rounded-xl border p-4"
                >
                  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="truncate font-medium">{{ language.name }}</span>
                        <span
                          v-if="language.is_source"
                          class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                        >
                          源语言
                        </span>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">
                        已翻译 {{ language.translated_count }} / {{ stats.total }}，剩余 {{ language.missing_count }}
                      </p>
                    </div>
                    <div class="text-right">
                      <div class="text-2xl font-semibold">
                        {{ language.progress }}%
                      </div>
                      <div class="text-[11px] text-muted-foreground">
                        {{ language.code }}
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      data-tone="success" class="detail-progress h-full rounded-full transition-all"
                      :style="{ width: `${language.progress}%` }"
                    />
                  </div>
                </article>
              </div>
            </div>
          </section>

          <div class="flex min-h-0 flex-col gap-4 overflow-hidden xl:h-[44rem]">
            <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold">
                    优先关注的语种
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    默认显示进度最低的 3 个目标语种。
                  </p>
                </div>
                <Languages class="size-4 text-muted-foreground" />
              </div>

              <div v-if="topAttentionLanguages.length === 0" class="mt-6 text-sm text-muted-foreground">
                暂无需要重点关注的语种。
              </div>

              <div v-else class="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                <div class="space-y-3">
                  <div
                    v-for="language in topAttentionLanguages"
                    :key="language.code"
                    class="rounded-xl border bg-muted/30 p-4"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-medium">
                          {{ language.name }}
                        </div>
                        <div class="mt-1 text-xs text-muted-foreground">
                          还缺 {{ language.missing_count }} 条
                        </div>
                      </div>
                      <div class="text-xl font-semibold">
                        {{ language.progress }}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold">
                    快捷入口
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    把常用动作放在右手边，减少切换成本。
                  </p>
                </div>
              </div>

              <div class="mt-5 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                <button
                  class="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  @click="goWorkbench"
                >
                  <div class="rounded-xl bg-primary/10 p-2 text-primary">
                    <Wrench class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">
                      打开工作台
                    </div>
                    <div class="text-xs text-muted-foreground">
                      继续翻译、校对或发布词条
                    </div>
                  </div>
                  <ArrowRight class="size-4 text-muted-foreground" />
                </button>

                <button
                  class="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  @click="goLogs"
                >
                  <div class="rounded-xl bg-primary/10 p-2 text-primary">
                    <Clock3 class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">
                      查看全部日志
                    </div>
                    <div class="text-xs text-muted-foreground">
                      按时间线回看所有变更与发布历史
                    </div>
                  </div>
                  <ArrowRight class="size-4 text-muted-foreground" />
                </button>

                <button
                  class="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  @click="router.push('/projects')"
                >
                  <div class="rounded-xl bg-primary/10 p-2 text-primary">
                    <FolderKanban class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">
                      管理项目设置
                    </div>
                    <div class="text-xs text-muted-foreground">
                      调整语言配置、项目描述和基础信息
                    </div>
                  </div>
                  <ArrowRight class="size-4 text-muted-foreground" />
                </button>
              </div>
            </section>
          </div>
        </div>

        <section class="rounded-xl border bg-card p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold">
                最近动态
              </h3>
              <p class="mt-1 text-xs text-muted-foreground">
                展示最新操作，帮助团队快速理解当前推进节奏。
              </p>
            </div>
            <UiButton variant="ghost" size="sm" class="text-xs" @click="goLogs">
              查看全部
            </UiButton>
          </div>

          <div v-if="recentLogs.length === 0" class="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            暂无动态记录。
          </div>

          <div v-else class="mt-6 space-y-4">
            <article
              v-for="log in recentLogs"
              :key="log.id"
              class="flex gap-4 rounded-xl border p-4"
            >
              <UiAvatar class="mt-0.5 size-10 shrink-0 border">
                <UiAvatarImage :src="log.user?.avatar_url || ''" />
                <UiAvatarFallback class="bg-primary/10 font-semibold text-primary">
                  {{ (log.user?.nickname || '?').charAt(0).toUpperCase() }}
                </UiAvatarFallback>
              </UiAvatar>

              <div class="min-w-0 flex-1">
                <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <p class="text-sm leading-6 text-foreground">
                      <span class="font-medium">{{ log.user?.nickname || '系统' }}</span>
                      <span class="mx-1 text-muted-foreground">
                        {{ log.scope === 'project' ? `批量创建了 ${log.item_count || 1} 个词条` : log.action }}
                      </span>
                      <span v-if="log.scope === 'project'" class="font-mono text-primary">
                        {{ log.term_keys?.slice(0, 3).join('、') || '批量词条' }}
                      </span>
                      <span v-else class="font-mono text-primary">{{ log.term?.key || '未知词条' }}</span>
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ log.scope === 'project' ? '项目级操作 / ' : (log.term?.module ? `${log.term.module} / ` : '') }}{{ formatDate(log.created_at) }}
                    </p>
                  </div>
                  <span class="shrink-0 text-xs text-muted-foreground">{{ formatRelativeTime(log.created_at) }}</span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
