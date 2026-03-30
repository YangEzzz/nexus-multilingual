<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Clock, User as UserIcon, Activity } from 'lucide-vue-next'
import { api } from '@/request'
import { toast } from 'vue-sonner'

defineOptions({ name: 'project-logs' })


const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.query.project as string)

interface LogItem {
  id: number
  term_id: number
  user_id: number
  action: string
  created_at: string
  term: {
    key: string
    module: string
  }
  user: {
    nickname: string
    avatar_url: string
  }
}

const logs = ref<LogItem[]>([])
const loading = ref(true)

async function fetchLogs() {
  if (!projectId.value) return
  loading.value = true
  try {
    const res = await api.get({ url: `/projects/${projectId.value}/logs` })
    logs.value = (res.data as LogItem[]) || []
  } catch (err: any) {
    toast.error('获取日志失败', { description: err.message })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!projectId.value) {
    toast.error('缺少项目 ID')
    router.back()
    return
  }
  fetchLogs()
})

function goBack() {
  router.back()
}

// 格式化时间
function formatTime(isoStr: string) {
  const date = new Date(isoStr)
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(date)
}
</script>

<template>
  <div class="h-[calc(100vh-120px)] flex flex-col max-w-5xl mx-auto w-full">
    <!-- Header -->
    <header class="flex items-center justify-between pb-6 mb-6 border-b border-gray-100 dark:border-zinc-800 shrink-0 mt-4">
      <div class="flex items-center gap-4">
        <UiButton variant="ghost" size="icon" @click="goBack" class="rounded-full w-8 h-8">
          <ArrowLeft class="w-4 h-4" />
        </UiButton>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            项目操作日志
          </h1>
          <p class="text-sm text-gray-500 mt-1">这里记录了项目中所有的内容修改、发布与删除动作（仅管理员可见）。</p>
        </div>
      </div>
      <UiButton variant="outline" size="sm" @click="fetchLogs" :disabled="loading">
        刷新
      </UiButton>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col py-20 items-center justify-center text-gray-400">
      <Clock class="w-8 h-8 animate-pulse mb-4 text-primary/40" />
      <span class="text-sm">正在加载全量日志数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="logs.length === 0" class="flex-1 flex flex-col py-20 items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-900/20">
      <Activity class="w-10 h-10 mb-4 text-gray-300" />
      <span class="text-sm text-gray-500">该项目暂无任何操作记录</span>
    </div>

    <!-- Timeline -->
    <div v-else class="flex-1 overflow-auto pr-4">
      <div class="relative py-4 pl-6 before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-gradient-to-b before:from-gray-200 before:via-gray-200 before:to-transparent dark:before:from-zinc-800 dark:before:via-zinc-800">
        <div v-for="log in logs" :key="log.id" class="relative mb-8 last:mb-0">
          <span class="absolute -left-6 top-1.5 w-3 h-3 bg-white dark:bg-zinc-950 border-[2px] border-primary rounded-full z-10 shadow-sm shadow-primary/20"></span>
          
          <div class="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 flex gap-4 transition-all hover:shadow-md hover:border-gray-200 dark:hover:border-zinc-700">
            <!-- User Avatar & Info -->
            <div class="shrink-0 flex flex-col items-center gap-1.5 w-16">
              <UiAvatar class="w-10 h-10 border border-gray-100 dark:border-zinc-800 shadow-sm">
                <UiAvatarImage :src="log.user?.avatar_url || ''" />
                <UiAvatarFallback class="bg-primary/5 text-primary text-xs font-semibold">
                  <UserIcon class="w-4 h-4" v-if="!log.user?.nickname" />
                  <span v-else>{{ log.user?.nickname.charAt(0).toUpperCase() }}</span>
                </UiAvatarFallback>
              </UiAvatar>
            </div>

            <!-- Action Content -->
            <div class="flex-1 min-w-0 flex flex-col">
              <div class="flex items-center justify-between gap-4 mb-2">
                <div class="flex items-center gap-2 text-sm flex-wrap">
                  <span class="font-bold text-gray-900 dark:text-gray-100">
                    {{ log.user?.nickname || '系统 / 未知用户' }}
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ log.action }}
                  </span>
                </div>
                <div class="shrink-0 text-xs font-medium text-gray-400 flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  {{ formatTime(log.created_at) }}
                </div>
              </div>

              <!-- Term Info Panel -->
              <div class="mt-1 bg-gray-50 dark:bg-zinc-950 rounded-md p-2.5 border border-gray-100/50 dark:border-zinc-800/50 flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded shrink-0" v-if="log.term?.module">
                  {{ log.term.module }}
                </span>
                <span class="font-bold text-xs text-gray-700 dark:text-gray-300 font-mono truncate" :title="log.term?.key || 'Deleted Term'">
                  {{ log.term?.key || '该词条可能已被删除' }}
                </span>
                <span v-if="log.term_id" class="ml-auto text-[10px] text-gray-400 font-mono">ID: {{ log.term_id }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
