<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
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
  Loader2,
  RefreshCw,
  Wrench,
} from 'lucide-vue-next'
import { api } from '@/request'
import { toast } from 'vue-sonner'

defineOptions({ name: 'dashboard' })

interface I18nProject {
  id: number
  name: string
  code: string
  description: string
  updated_at: string
  languages?: Array<{ code: string, name: string, is_source?: boolean }>
}

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
  id: number
  action: string
  created_at: string
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
const dashboard = ref<DashboardPayload | null>(null)
const loadingProjects = ref(true)
const loadingDashboard = ref(false)

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
  if (!stats.value?.total) return 0
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
  if (!currentStats) return []

  return [
    {
      label: '已发布',
      value: currentStats.published,
      hint: `${publishedRate.value}% 已完成`,
      icon: CheckCircle2,
      tone: 'text-emerald-600',
      bg: 'from-emerald-500/12 via-emerald-500/6 to-transparent',
      border: 'border-emerald-200/70 dark:border-emerald-900/50',
    },
    {
      label: '待审查',
      value: currentStats.review,
      hint: `${focus.value?.terms_ready_for_review ?? 0} 条可处理`,
      icon: AlertCircle,
      tone: 'text-sky-600',
      bg: 'from-sky-500/12 via-sky-500/6 to-transparent',
      border: 'border-sky-200/70 dark:border-sky-900/50',
    },
    {
      label: '待翻译',
      value: currentStats.pending,
      hint: `${focus.value?.terms_pending ?? 0} 条进行中`,
      icon: Clock3,
      tone: 'text-amber-600',
      bg: 'from-amber-500/12 via-amber-500/6 to-transparent',
      border: 'border-amber-200/70 dark:border-amber-900/50',
    },
    {
      label: '草稿',
      value: currentStats.draft,
      hint: `${focus.value?.draft_terms ?? 0} 条待补充`,
      icon: FileEdit,
      tone: 'text-slate-600',
      bg: 'from-slate-500/12 via-slate-500/6 to-transparent',
      border: 'border-slate-200/70 dark:border-slate-800/70',
    },
  ]
})

async function loadProjects() {
  loadingProjects.value = true
  try {
    const res = await api.get<I18nProject[]>({ url: '/projects' })
    projects.value = res.data ?? []
    const savedProjectId = Number(localStorage.getItem('dashboard_project_id') || '')
    const defaultProject = projects.value.find(project => project.id === savedProjectId) ?? projects.value[0] ?? null

    if (defaultProject) {
      selectedProjectId.value = defaultProject.id
      await loadDashboard()
    }
  } catch (error: any) {
    toast.error('加载项目失败', { description: error.message })
  } finally {
    loadingProjects.value = false
  }
}

async function loadDashboard() {
  if (!selectedProjectId.value) return

  loadingDashboard.value = true
  try {
    const res = await api.get<DashboardPayload>({ url: `/projects/${selectedProjectId.value}/dashboard` })
    dashboard.value = res.data
    localStorage.setItem('dashboard_project_id', String(selectedProjectId.value))
  } catch (error: any) {
    toast.error('加载仪表盘失败', { description: error.message })
  } finally {
    loadingDashboard.value = false
  }
}

async function switchProject(id: number) {
  if (selectedProjectId.value === id && dashboard.value)
    return

  selectedProjectId.value = id
  await loadDashboard()
}

function goWorkbench() {
  if (!selectedProjectId.value) return
  router.push({ path: '/workbench', query: { project: selectedProjectId.value } })
}

function goLogs() {
  if (!selectedProjectId.value) return
  router.push({ path: '/project-logs', query: { project: selectedProjectId.value } })
}

function formatRelativeTime(value?: string | null) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function formatDate(value?: string | null) {
  if (!value) return '暂无'
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
  <div class="min-h-0 space-y-6 p-2">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">仪表盘</h1>
        <p class="mt-1 text-sm text-muted-foreground">聚焦当前项目的翻译进度、阻塞点和最近动态。</p>
      </div>

      <div class="flex items-center gap-2">
        <UiButton variant="outline" size="icon" class="rounded-full" :disabled="isLoading" @click="loadDashboard">
          <RefreshCw class="size-4" :class="isLoading ? 'animate-spin' : ''" />
        </UiButton>
        <UiButton :disabled="!selectedProjectId" @click="goWorkbench">
          <Wrench class="mr-2 size-4" />
          进入工作台
        </UiButton>
      </div>
    </div>

    <div v-if="loadingProjects" class="flex items-center gap-2 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" />
      正在加载项目列表...
    </div>

    <div v-else-if="projects.length === 0" class="rounded-3xl border border-dashed bg-card/70 p-10 text-center">
      <FolderKanban class="mx-auto mb-4 size-10 text-muted-foreground/60" />
      <h2 class="text-lg font-semibold">还没有翻译项目</h2>
      <p class="mt-2 text-sm text-muted-foreground">先创建项目，再回来查看整体进度与翻译健康度。</p>
      <UiButton class="mt-5" @click="router.push('/projects')">前往项目管理</UiButton>
    </div>

    <template v-else>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="project in projects"
          :key="project.id"
          class="rounded-full border px-4 py-2 text-sm transition-all"
          :class="selectedProjectId === project.id
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'"
          @click="switchProject(project.id)"
        >
          {{ project.name }}
        </button>
      </div>

      <div v-if="loadingDashboard && !dashboard" class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div class="h-52 animate-pulse rounded-3xl bg-muted/60" />
        <div class="h-52 animate-pulse rounded-3xl bg-muted/60" />
      </div>

      <template v-else-if="dashboard && currentProject && stats && focus">
        <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section class="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background">
            <div class="flex h-full flex-col gap-6 p-6">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="space-y-2">
                  <div class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                    <FolderKanban class="size-3.5" />
                    当前项目
                  </div>
                  <div>
                    <h2 class="text-2xl font-semibold tracking-tight">{{ currentProject.name }}</h2>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ currentProject.code }}</p>
                  </div>
                  <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {{ currentProject.description || '这个项目还没有补充描述，可以在项目管理中完善背景说明与命名规范。' }}
                  </p>
                </div>

                <div class="grid gap-2 text-sm text-muted-foreground">
                  <div class="rounded-2xl border bg-background/70 px-4 py-3">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">最近活跃</div>
                    <div class="mt-1 font-medium text-foreground">{{ formatRelativeTime(dashboard.last_activity_at) }}</div>
                  </div>
                  <div class="rounded-2xl border bg-background/70 px-4 py-3">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">最近更新</div>
                    <div class="mt-1 font-medium text-foreground">{{ formatDate(currentProject.updated_at) }}</div>
                  </div>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl border bg-background/75 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">词条总量</div>
                  <div class="mt-2 text-3xl font-semibold">{{ stats.total }}</div>
                </div>
                <div class="rounded-2xl border bg-background/75 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">目标语种</div>
                  <div class="mt-2 text-3xl font-semibold">{{ targetLanguageCount }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    源语言：{{ sourceLanguage?.name || '未设置' }}
                  </div>
                </div>
                <div class="rounded-2xl border bg-background/75 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">整体发布率</div>
                  <div class="mt-2 text-3xl font-semibold">{{ publishedRate }}%</div>
                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
                    <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${publishedRate}%` }" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-3xl border bg-card p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">当前关注点</h3>
                <p class="mt-1 text-xs text-muted-foreground">用最少信息先看清下一步要做什么。</p>
              </div>
              <CircleDotDashed class="size-4 text-muted-foreground" />
            </div>

            <div class="mt-5 space-y-3">
              <div class="flex items-start justify-between rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-950 dark:bg-sky-950/20">
                <div>
                  <div class="text-sm font-medium text-sky-700 dark:text-sky-300">优先审查</div>
                  <p class="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">已补全翻译、可以进入 review 的词条</p>
                </div>
                <div class="text-2xl font-semibold text-sky-700 dark:text-sky-300">{{ focus.terms_ready_for_review }}</div>
              </div>

              <div class="flex items-start justify-between rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-950 dark:bg-amber-950/20">
                <div>
                  <div class="text-sm font-medium text-amber-700 dark:text-amber-300">翻译进行中</div>
                  <p class="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">仍有语种缺口，需要继续补齐</p>
                </div>
                <div class="text-2xl font-semibold text-amber-700 dark:text-amber-300">{{ focus.terms_pending }}</div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl border p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">24h 变更</div>
                  <div class="mt-2 text-2xl font-semibold">{{ focus.recent_changes_24h }}</div>
                </div>
                <div class="rounded-2xl border p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">超 7 天未收口</div>
                  <div class="mt-2 text-2xl font-semibold">{{ focus.stale_terms }}</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section class="rounded-3xl border bg-card p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">流程状态</h3>
                <p class="mt-1 text-xs text-muted-foreground">从草稿到发布，当前积压一眼看清。</p>
              </div>
              <Activity class="size-4 text-muted-foreground" />
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article
                v-for="card in statCards"
                :key="card.label"
                class="rounded-2xl border bg-gradient-to-br p-4"
                :class="[card.border, card.bg]"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium" :class="card.tone">{{ card.label }}</span>
                  <component :is="card.icon" class="size-4" :class="card.tone" />
                </div>
                <div class="mt-4 text-3xl font-semibold">{{ card.value }}</div>
                <p class="mt-1 text-xs text-muted-foreground">{{ card.hint }}</p>
              </article>
            </div>
          </section>

          <section class="rounded-3xl border bg-card p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">最近 7 天活跃度</h3>
                <p class="mt-1 text-xs text-muted-foreground">根据日志条数观察项目活跃程度。</p>
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
                    class="w-full rounded-t-xl bg-gradient-to-t from-primary to-primary/40 transition-all"
                    :style="{ height: trendBarHeight(point) }"
                  />
                </div>
                <div class="text-center text-[11px] text-muted-foreground">
                  {{ point.date.slice(5).replace('-', '/') }}
                </div>
                <div class="text-[11px] font-medium text-foreground">{{ point.count }}</div>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
          <section class="flex min-h-0 flex-col rounded-3xl border bg-card p-6 shadow-sm xl:h-[44rem]">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">语种健康度</h3>
                <p class="mt-1 text-xs text-muted-foreground">优先把落后的语言包补齐，避免后续集中返工。</p>
              </div>
              <div class="text-xs text-muted-foreground">
                共 {{ languageCoverage.length }} 个语种
              </div>
            </div>

            <div v-if="sortedLanguages.length === 0" class="mt-8 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              当前项目还没有配置语言。
            </div>

            <div v-else class="mt-5 min-h-0 flex-1 overflow-hidden">
              <div class="h-full space-y-4 overflow-y-auto pr-2">
                <article
                  v-for="language in sortedLanguages"
                  :key="language.code"
                  class="rounded-2xl border p-4"
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
                      <div class="text-2xl font-semibold">{{ language.progress }}%</div>
                      <div class="text-[11px] text-muted-foreground">{{ language.code }}</div>
                    </div>
                  </div>

                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="language.progress >= 90 ? 'bg-emerald-500' : language.progress >= 60 ? 'bg-amber-500' : 'bg-rose-500'"
                      :style="{ width: `${language.progress}%` }"
                    />
                  </div>
                </article>
              </div>
            </div>
          </section>

          <div class="flex min-h-0 flex-col gap-4 overflow-hidden xl:h-[44rem]">
            <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-card p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold">优先关注的语种</h3>
                  <p class="mt-1 text-xs text-muted-foreground">默认显示进度最低的 3 个目标语种。</p>
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
                    class="rounded-2xl border bg-muted/30 p-4"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-medium">{{ language.name }}</div>
                        <div class="mt-1 text-xs text-muted-foreground">还缺 {{ language.missing_count }} 条</div>
                      </div>
                      <div class="text-xl font-semibold">{{ language.progress }}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-card p-6 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold">快捷入口</h3>
                  <p class="mt-1 text-xs text-muted-foreground">把常用动作放在右手边，减少切换成本。</p>
                </div>
              </div>

              <div class="mt-5 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                <button
                  class="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  @click="goWorkbench"
                >
                  <div class="rounded-xl bg-primary/10 p-2 text-primary">
                    <Wrench class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">打开工作台</div>
                    <div class="text-xs text-muted-foreground">继续翻译、审查或发布词条</div>
                  </div>
                  <ArrowRight class="size-4 text-muted-foreground" />
                </button>

                <button
                  class="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  @click="goLogs"
                >
                  <div class="rounded-xl bg-primary/10 p-2 text-primary">
                    <Clock3 class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">查看全部日志</div>
                    <div class="text-xs text-muted-foreground">按时间线回看所有变更与发布历史</div>
                  </div>
                  <ArrowRight class="size-4 text-muted-foreground" />
                </button>

                <button
                  class="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  @click="router.push('/projects')"
                >
                  <div class="rounded-xl bg-primary/10 p-2 text-primary">
                    <FolderKanban class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">管理项目设置</div>
                    <div class="text-xs text-muted-foreground">调整语言配置、项目描述和基础信息</div>
                  </div>
                  <ArrowRight class="size-4 text-muted-foreground" />
                </button>
              </div>
            </section>
          </div>
        </div>

        <section class="rounded-3xl border bg-card p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold">最近动态</h3>
              <p class="mt-1 text-xs text-muted-foreground">展示最新操作，帮助团队快速理解当前推进节奏。</p>
            </div>
            <UiButton variant="ghost" size="sm" class="text-xs" @click="goLogs">查看全部</UiButton>
          </div>

          <div v-if="recentLogs.length === 0" class="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            暂无动态记录。
          </div>

          <div v-else class="mt-6 space-y-4">
            <article
              v-for="log in recentLogs"
              :key="log.id"
              class="flex gap-4 rounded-2xl border p-4"
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
                      <span class="mx-1 text-muted-foreground">{{ log.action }}</span>
                      <span class="font-mono text-primary">{{ log.term?.key || '未知词条' }}</span>
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ log.term?.module ? `${log.term.module} / ` : '' }}{{ formatDate(log.created_at) }}
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
