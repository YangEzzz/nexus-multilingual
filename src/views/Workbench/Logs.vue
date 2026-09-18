<script setup lang="ts">
import {
  Activity,
  ArrowLeft,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  User as UserIcon,
  Wand2,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { api } from '@/request'

defineOptions({ name: 'ProjectLogs' })

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.query.project as string)

interface LogItem {
  id: number | string
  scope?: 'term' | 'project'
  term_id?: number
  user_id: number
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

interface DisplayLogItem extends LogItem {
  batch_count: number
  batch_terms: Array<{
    key: string
    module: string
  }>
  batch_last_at: string
}

const BATCH_CREATE_ACTION = '通过快捷批量创建录入'
const BATCH_LOG_WINDOW_MS = 5000

const logs = ref<LogItem[]>([])
const loading = ref(true)
const loadError = ref('')

const groupedLogs = computed<DisplayLogItem[]>(() => {
  const result: DisplayLogItem[] = []

  for (const log of logs.value) {
    if (log.scope === 'project' && log.action === BATCH_CREATE_ACTION) {
      result.push({
        ...log,
        batch_count: log.item_count || 1,
        batch_terms: (log.term_keys || []).map(key => ({ key, module: '' })),
        batch_last_at: log.created_at,
      })
      continue
    }

    const previous = result[result.length - 1]
    const canMergeBatch = log.action === BATCH_CREATE_ACTION
      && previous?.action === BATCH_CREATE_ACTION
      && previous.scope !== 'project'
      && previous.user_id === log.user_id
      && Math.abs(new Date(previous.batch_last_at).getTime() - new Date(log.created_at).getTime()) <= BATCH_LOG_WINDOW_MS

    if (canMergeBatch) {
      previous.batch_count += 1
      previous.batch_last_at = log.created_at
      if (log.term)
        previous.batch_terms.push(log.term)
      continue
    }

    result.push({
      ...log,
      batch_count: 1,
      batch_terms: log.term ? [log.term] : [],
      batch_last_at: log.created_at,
    })
  }

  return result
})

const visibleLogCount = computed(() => groupedLogs.value.length)

const isBatchLog = (log: DisplayLogItem) => {
  return log.action === BATCH_CREATE_ACTION
}

const getBatchTermSummary = (log: DisplayLogItem) => {
  const visibleKeys = log.batch_terms.slice(0, 3).map(term => term.key).filter(Boolean)
  if (visibleKeys.length === 0)
    return `共 ${log.batch_count} 个词条`

  const suffix = log.batch_count > visibleKeys.length ? ` 等 ${log.batch_count} 个词条` : ''
  return `${visibleKeys.join('、')}${suffix}`
}

const getActionIcon = (action: string) => {
  if (action.includes('删除'))
    return Trash2
  if (action.includes('发布'))
    return Send
  if (action.includes('创建') || action.includes('录入'))
    return Plus
  if (action.includes('AI') || action.includes('翻译'))
    return Wand2
  if (action.includes('编辑') || action.includes('更新') || action.includes('修改'))
    return Pencil
  return Activity
}

const getActionTone = (action: string) => {
  if (action.includes('删除'))
    return 'bg-destructive/10 text-destructive'
  if (action.includes('发布'))
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (action.includes('创建') || action.includes('录入'))
    return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
  if (action.includes('AI') || action.includes('翻译'))
    return 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
  return 'bg-muted text-muted-foreground'
}

const getActionText = (log: DisplayLogItem) => {
  if (isBatchLog(log))
    return `批量创建了 ${log.batch_count} 个词条`
  return log.action
}

const fetchLogs = async () => {
  if (!projectId.value)
    return

  loading.value = true
  loadError.value = ''
  try {
    const res = await api.get({ url: `/projects/${projectId.value}/logs` })
    logs.value = (res.data as LogItem[]) || []
  }
  catch {
    loadError.value = '操作日志暂时无法加载，请检查网络后重试。'
    toast.error('获取日志失败', { description: '请稍后重试。' })
  }
  finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const formatTime = (isoStr: string) => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(isoStr))
}

onMounted(() => {
  document.title = '操作日志 — Nexus Multilingual'
  if (!projectId.value) {
    toast.error('缺少项目 ID')
    router.back()
    return
  }
  fetchLogs()
})
</script>

<template>
  <div class="min-h-0 space-y-6 p-4 lg:p-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-start gap-3">
        <UiButton variant="ghost" size="icon" class="mt-0.5 shrink-0" aria-label="返回词条工作台" @click="goBack">
          <ArrowLeft class="size-4" />
        </UiButton>
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold tracking-tight text-foreground">
            操作日志
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            查看当前项目的词条变更、发布和批量操作记录
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3 pl-12 sm:pl-0">
        <span class="text-sm text-muted-foreground">共 {{ visibleLogCount }} 条</span>
        <UiButton variant="outline" size="sm" :disabled="loading" :aria-busy="loading" @click="fetchLogs">
          <RefreshCw class="mr-2 size-4" :class="{ 'animate-spin': loading }" />
          {{ loading ? '刷新中' : '刷新' }}
        </UiButton>
      </div>
    </header>

    <main class="min-h-[30rem] overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div v-if="loading" class="flex min-h-[24rem] flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
        <span class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Loader2 class="size-5 animate-spin" />
        </span>
        <p class="mt-3 text-sm font-medium text-foreground">
          正在加载操作日志
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          正在同步该项目的最新记录…
        </p>
      </div>

      <div v-else-if="loadError" class="flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
        <span class="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Activity class="size-5" />
        </span>
        <p class="mt-3 text-sm font-medium text-foreground">
          加载失败
        </p>
        <p class="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          {{ loadError }}
        </p>
        <UiButton variant="outline" class="mt-4" @click="fetchLogs">
          <RefreshCw class="mr-2 size-4" />
          重试
        </UiButton>
      </div>

      <UiEmpty v-else-if="groupedLogs.length === 0" class="min-h-[24rem] border-0">
        <UiEmptyHeader>
          <UiEmptyMedia variant="icon">
            <Activity />
          </UiEmptyMedia>
          <UiEmptyTitle>暂无操作记录</UiEmptyTitle>
          <UiEmptyDescription>
            项目内的词条变更、发布和批量操作会显示在这里
          </UiEmptyDescription>
        </UiEmptyHeader>
      </UiEmpty>

      <template v-else>
        <div
          class="hidden grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-3 border-b border-border bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground sm:grid"
          aria-hidden="true"
        >
          <span />
          <span>操作记录</span>
          <span>操作时间</span>
        </div>

        <ol class="divide-y divide-border/70">
          <li v-for="log in groupedLogs" :key="log.id" class="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] lg:px-5">
            <span class="flex size-9 items-center justify-center rounded-lg" :class="getActionTone(log.action)" aria-hidden="true">
              <component :is="getActionIcon(log.action)" class="size-4" />
            </span>

            <div class="min-w-0">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <UiAvatar class="size-6 shrink-0 border border-border">
                  <UiAvatarImage v-if="log.user?.avatar_url" :src="log.user.avatar_url" />
                  <UiAvatarFallback class="text-[10px]">
                    <UserIcon v-if="!log.user?.nickname" class="size-3" />
                    <template v-else>
                      {{ log.user.nickname.slice(0, 1) }}
                    </template>
                  </UiAvatarFallback>
                </UiAvatar>
                <span class="font-medium text-foreground">{{ log.user?.nickname || '系统 / 未知用户' }}</span>
                <span class="text-muted-foreground">{{ getActionText(log) }}</span>
              </div>

              <div v-if="isBatchLog(log)" class="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                <span class="rounded-md border border-border bg-muted/60 px-2 py-1 text-xs font-medium text-foreground">
                  批量 · {{ log.batch_count }}
                </span>
                <span class="min-w-0 truncate font-mono text-xs text-muted-foreground" :title="log.batch_terms.map(term => term.key).join('、')">
                  {{ getBatchTermSummary(log) }}
                </span>
              </div>

              <div v-else-if="log.term" class="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                <span class="truncate font-mono text-xs font-semibold text-foreground">
                  {{ log.term.key }}
                </span>
                <span class="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {{ log.term.module || '无模块' }}
                </span>
                <span class="font-mono text-[10px] text-muted-foreground/70">#{{ log.term_id }}</span>
              </div>

              <p v-else class="mt-2 text-xs text-muted-foreground">
                该词条可能已被删除
              </p>
            </div>

            <time class="col-start-2 flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:col-start-auto sm:pt-1" :datetime="log.created_at">
              <Clock3 class="size-3.5" aria-hidden="true" />
              {{ formatTime(log.created_at) }}
            </time>
          </li>
        </ol>
      </template>
    </main>
  </div>
</template>
