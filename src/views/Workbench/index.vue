<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, Plus, Trash2, Search, CalendarDays, Wand2, Loader2 } from 'lucide-vue-next'
import { ai } from '@/lib/gemini'
import { toast } from 'vue-sonner'

interface Translation {
  [key: string]: string
}

interface TermItem {
  id: string;
  module: string;
  key: string;
  description: string;
  translations: Translation;
  status: 'draft' | 'pending' | 'review' | 'published';
  updatedAt?: string;
  history?: Array<{ time: string; action: string; user: string }>;
}

interface Language {
  code: string;
  name: string;
}

const targetLanguages = ref<Language[]>([
  { code: 'cn', name: '简体中文' },
  { code: 'cht', name: '繁体中文' },
  { code: 'en', name: '英文' },
  { code: 'jp', name: '日语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' },
  { code: 'de', name: '德语' },
  { code: 'fr', name: '法语' },
  { code: 'ko', name: '韩语' },
  { code: 'th', name: '泰语' },
  { code: 'vi', name: '越南语' },
  { code: 'ind', name: '印尼语' },
  { code: 'tr', name: '土耳其语' },
  { code: 'bn', name: '孟加拉语' },
  { code: 'pl', name: '波兰语' },
  { code: 'it', name: '意大利语' }
])

const terms = ref<TermItem[]>([
  {
    id: '1',
    module: 'common',
    key: 'confirm',
    description: '确认按钮通用文本',
    status: 'published',
    updatedAt: '2026-02-26 15:30:00',
    history: [
      { time: '2026-02-26 15:30:00', action: '将状态变更为 已发布', user: '系统管理员' },
      { time: '2026-02-25 10:12:00', action: '更新了 en 翻译', user: '张三' }
    ],
    translations: {
      'en': 'Confirm',
      'cn': '确认',
      'jp': '確認'
    }
  },
  {
    id: '2',
    module: 'login',
    key: 'username_placeholder',
    description: '登录页面的用户名输入框占位符',
    status: 'draft',
    translations: {
      'en': 'Enter username',
      'cn': '请输入用户名',
      'jp': 'ユーザー名を入力してください'
    }
  },
  {
    id: '3',
    module: '',
    key: 'global_app_title',
    description: '全局应用名称（无模块示例）',
    status: 'published',
    updatedAt: '2026-02-20 09:20:00',
    translations: {
      'en': 'Nexus Platform',
      'cn': 'Nexus 平台',
      'jp': 'Nexus プラットフォーム'
    }
  }
])

const searchQuery = ref('')
const selectedModule = ref('all')
const selectedStatus = ref('all')

const modules = computed(() => {
  const mods = new Set(terms.value.map(t => t.module))
  return Array.from(mods)
})

const filteredTerms = computed(() => {
  return terms.value.filter(term => {
    // Search match
    const matchSearch = term.key.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                       term.module.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    // Module match
    const matchModule = selectedModule.value === 'all' || 
                        (selectedModule.value === '__none__' && term.module === '') || 
                        term.module === selectedModule.value
    
    // Status match
    const matchStatus = selectedStatus.value === 'all' || term.status === selectedStatus.value

    return matchSearch && matchModule && matchStatus
  })
})

const statusOptions = [
  { value: 'draft', label: '草稿', color: 'bg-gray-500' },
  { value: 'pending', label: '待翻译', color: 'bg-yellow-500' },
  { value: 'review', label: '待校对', color: 'bg-blue-500' },
  { value: 'published', label: '已发布', color: 'bg-green-500' }
]


function getStatusColor(status: string) {
  return statusOptions.find(o => o.value === status)?.color || 'bg-gray-500'
}

function addNewTerm() {
  terms.value.unshift({
    id: Date.now().toString(),
    module: '',
    key: 'new_key',
    description: '',
    status: 'draft',
    translations: targetLanguages.value.reduce((acc, lang) => {
      acc[lang.code] = ''
      return acc
    }, {} as Translation),
    updatedAt: new Date().toLocaleString(),
    history: [
      { time: new Date().toLocaleString(), action: '创建了词条', user: '当前用户' }
    ]
  })
}

function deleteTerm(id: string) {
  terms.value = terms.value.filter(t => t.id !== id)
}

const translatingTerms = ref(new Set<string>())

async function translateRow(term: TermItem) {
  if (translatingTerms.value.has(term.id)) return
  
  translatingTerms.value.add(term.id)
  try {
    const prompt = `翻译以下内容，这是一个智能体APP的内容并将其翻译为本地化语言。
格式要求：你必须返回一个合法的 JSON 对象。不要返回任何 Markdown 标记符（如 \`\`\`json ），不要返回任何解释。
JSON 键名必须严格是以下这些代号：cn, en, cht, de, fr, ru, jp, pt, es, vi, th, ind，对应的值为各个语言翻译后的文本。如果有某个语言你不知道怎么翻译，请返回空字符串 ""。

待翻译原文参考：
描述和上下文: ${term.description || '无'}
现有参考翻译 (若有可参考，若无请根据键名和描述推断):
${Object.entries(term.translations).filter(([_, val]) => val).map(([lang, val]) => `${lang}: ${val}`).join('\n')}
`

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.2
      }
    });

    const result = response.text?.trim() || ''
    // clean up potential markdown tags if the model still outputs them
    const cleanJsonStr = result.replace(/^```json/gi, '').replace(/^```/g, '').replace(/```$/g, '').trim()
    
    let translatedData = {}
    try {
      translatedData = JSON.parse(cleanJsonStr)
    } catch(e) {
      console.error('Failed to parse JSON form AI response:', cleanJsonStr)
      throw new Error('AI 返回的数据格式无法解析为 JSON')
    }

    // fill the translated data back into the row
    targetLanguages.value.forEach(lang => {
      if (translatedData[lang.code as keyof typeof translatedData] !== undefined) {
        term.translations[lang.code] = translatedData[lang.code as keyof typeof translatedData]
      }
    })

    // Update history
    if (!term.history) term.history = []
    term.history.unshift({
      time: new Date().toLocaleString(),
      action: '使用了 AI 进行了全语言自动翻译',
      user: 'AI 助理'
    })
    term.updatedAt = new Date().toLocaleString()

  } catch (error) {
    console.error('AI 翻译失败:', error)
    toast.error('AI 翻译失败', {
      description: '请检查控制台或网络配置。'
    })
  } finally {
    translatingTerms.value.delete(term.id)
  }
}

const activeEditKey = ref<string | null>(null)

function startEdit(key: string) {
  activeEditKey.value = key
}

function stopEdit() {
  activeEditKey.value = null
}

const focusElement = (el: any) => {
  if (el && typeof el.focus === 'function') {
    // Focus automatically when the element is mounted
    el.focus()
  }
}

const showExportModal = ref(false)
const selectedExportLangs = ref<string[]>([])
const isDrawerOpen = ref(false)
const activeDrawerTerm = ref<TermItem | null>(null)
const presentDeletingId = ref<string | null>(null)

function openDrawer(term: TermItem) {
  activeDrawerTerm.value = term
  isDrawerOpen.value = true
}

function closeDrawer() {
  isDrawerOpen.value = false
  activeDrawerTerm.value = null
}

// Default exclusions: 'tr' (土耳其语), 'bn' (孟加拉语), 'pl' (波兰语), 'it' (意大利语)
const defaultExcludedLangs = ['tr', 'bn', 'pl', 'it']

function openExportModal() {
  selectedExportLangs.value = targetLanguages.value
    .map(lang => lang.code)
    .filter(code => !defaultExcludedLangs.includes(code))
  showExportModal.value = true
}

function closeExportModal() {
  showExportModal.value = false
}

function toggleExportLang(code: string) {
  const index = selectedExportLangs.value.indexOf(code)
  if (index > -1) {
    selectedExportLangs.value.splice(index, 1)
  } else {
    selectedExportLangs.value.push(code)
  }
}

function selectAllExportLangs() {
  selectedExportLangs.value = targetLanguages.value.map(lang => lang.code)
}

function deselectAllExportLangs() {
  selectedExportLangs.value = []
}

function confirmExport() {
  if (selectedExportLangs.value.length === 0) {
    toast.warning('导出提醒', {
      description: '请至少选择一种语言导出！'
    })
    return
  }

  const langsToExport = targetLanguages.value.filter(lang => selectedExportLangs.value.includes(lang.code))
  
  langsToExport.forEach(lang => {
    const exportData: Record<string, string> = {}
    
    terms.value.forEach(term => {
      // flat key format: module.key or just key if module is empty
      const fullKey = term.module ? `${term.module}.${term.key}` : term.key
      exportData[fullKey] = term.translations[lang.code] || ''
    })

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lang.code}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
  
  // Alert the user
  toast.success('导出成功', {
    description: `已触发 ${langsToExport.length} 个语言文件的下载！`
  })
  closeExportModal()
}

</script>

<template>
  <div class="h-full flex flex-col p-6 space-y-4 bg-gray-50 dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">词条工作台 (Workbench)</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          单机版体验：支持本地新增、修改、过滤，并导出为多语言 JSON 文件。
        </p>
      </div>
      <div class="flex gap-2">
        <UiButton 
          @click="addNewTerm"
        >
          <Plus class="w-4 h-4 mr-2" />
          新建词条
        </UiButton>
        <UiButton 
          variant="secondary"
          @click="openExportModal"
        >
          <Download class="w-4 h-4 mr-2" />
          多语言导出...
        </UiButton>
      </div>
    </div>

    <!-- 顶栏过滤器 -->
    <div class="flex gap-4 p-4 bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800">
      <div class="flex-1 relative">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <UiInput 
          v-model="searchQuery" 
          placeholder="搜索 Keyword... (例如 confirm)"
          class="pl-9"
        />
      </div>
      
      <UiSelect v-model="selectedModule">
        <UiSelectTrigger class="w-[180px]">
          <UiSelectValue placeholder="选择模块" />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem value="all">所有模块</UiSelectItem>
          <UiSelectItem v-for="mod in modules" :key="mod" :value="mod === '' ? '__none__' : mod">
            {{ mod === '' ? '(无模块)' : mod }}
          </UiSelectItem>
        </UiSelectContent>
      </UiSelect>

      <UiSelect v-model="selectedStatus">
        <UiSelectTrigger class="w-[180px]">
          <UiSelectValue placeholder="选择状态" />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem value="all">所有状态</UiSelectItem>
          <UiSelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </UiSelectItem>
        </UiSelectContent>
      </UiSelect>
    </div>

    <!-- 工作台主区域 -->
    <div class="flex-1 overflow-auto bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800">
      <UiTable>
        <UiTableHeader class="bg-gray-50 dark:bg-zinc-900 sticky top-0 z-10 border-b border-gray-200 dark:border-zinc-700">
          <UiTableRow>
            <UiTableHead class="w-24 text-center">操作</UiTableHead>
            <UiTableHead class="w-64 min-w-[16rem]">词条 Key & 信息</UiTableHead>
            <UiTableHead v-for="lang in targetLanguages" :key="lang.code" class="min-w-[16rem]">
              {{ lang.name }} <span class="text-xs font-normal text-gray-400">({{ lang.code }})</span>
            </UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          <UiTableRow 
            v-for="term in filteredTerms" 
            :key="term.id"
            class="hover:bg-gray-50/50 dark:hover:bg-zinc-900/50 transition border-b border-gray-100 dark:border-zinc-800"
          >
            <!-- 操作列 -->
            <UiTableCell class="align-top text-center text-gray-400 p-3">
              <UiTooltipProvider>
                <div class="flex flex-col gap-2 items-center">
                  <UiTooltip>
                    <UiTooltipTrigger as-child>
                      <button 
                        @click="translateRow(term)"
                        :disabled="translatingTerms.has(term.id)"
                        class="p-1.5 hover:text-primary hover:bg-primary/10 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-primary/80"
                      >
                        <Loader2 v-if="translatingTerms.has(term.id)" class="w-4 h-4 animate-spin" />
                        <Wand2 v-else class="w-4 h-4" />
                      </button>
                    </UiTooltipTrigger>
                    <UiTooltipContent side="right">
                      <p>ai翻译</p>
                    </UiTooltipContent>
                  </UiTooltip>
                  
                  <UiAlertDialog @update:open="val => presentDeletingId = val ? term.id : null">
                    <UiTooltip :open="presentDeletingId === term.id ? false : undefined">
                      <UiTooltipTrigger as-child>
                        <UiAlertDialogTrigger as-child>
                          <button 
                            class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition"
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </UiAlertDialogTrigger>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="right">
                        <p>删除</p>
                      </UiTooltipContent>
                    </UiTooltip>
                    
                    <UiAlertDialogContent @close-auto-focus="(e) => e.preventDefault()">
                      <UiAlertDialogHeader>
                        <UiAlertDialogTitle>确认删除该词条吗？</UiAlertDialogTitle>
                        <UiAlertDialogDescription>
                          您正在尝试删除词条 <strong class="text-foreground">{{ term.key }}</strong>。此操作无法撤销，将丢失所有相关的多语言翻译记录。
                        </UiAlertDialogDescription>
                      </UiAlertDialogHeader>
                      <UiAlertDialogFooter>
                        <UiAlertDialogCancel>取消</UiAlertDialogCancel>
                        <UiAlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="deleteTerm(term.id)">
                          确认删除
                        </UiAlertDialogAction>
                      </UiAlertDialogFooter>
                    </UiAlertDialogContent>
                  </UiAlertDialog>
                </div>
              </UiTooltipProvider>
            </UiTableCell>

            <!-- 词条基础信息列 -->
            <UiTableCell class="align-top p-3">
              <div class="flex flex-col gap-1.5">
                <!-- Module -->
                <div v-if="activeEditKey === term.id + '-module'">
                  <UiInput 
                    v-model="term.module" 
                    :ref="focusElement"
                    @blur="stopEdit"
                    @keydown.enter="stopEdit"
                    class="h-7 text-xs font-mono text-primary bg-primary/10 px-1.5 py-0 min-w-[5rem] border-primary/30 placeholder:text-primary/50 font-medium"
                    placeholder="模块(可选)"
                  />
                </div>
                <div 
                  v-else 
                  @click="startEdit(term.id + '-module')"
                  class="text-xs font-mono text-primary bg-primary/10 px-1.5 py-1 rounded w-max cursor-text hover:ring-1 hover:ring-primary/40 transition-shadow min-h-[24px] flex items-center"
                >
                  {{ term.module || '无模块' }}
                </div>

                <!-- Key -->
                <div class="flex items-center gap-2">
                  <div v-if="activeEditKey === term.id + '-key'" class="flex-1">
                    <UiInput 
                      v-model="term.key"
                      :ref="focusElement"
                      @blur="stopEdit"
                      @keydown.enter="stopEdit"
                      class="h-7 text-sm font-semibold border-b border-t-0 border-l-0 border-r-0 border-gray-400 focus-visible:ring-0 px-1 py-0 shadow-none rounded-none"
                      placeholder="词条键名"
                    />
                  </div>
                  <div 
                    v-else 
                    @click="openDrawer(term)"
                    class="font-semibold text-primary cursor-pointer hover:underline px-1 py-0.5 rounded transition-colors break-words min-h-[28px] flex-1 flex items-center"
                    title="点击打开详情侧边栏"
                  >
                    {{ term.key || '未命名键值' }}
                  </div>
                </div>

                <!-- Description -->
                <div v-if="activeEditKey === term.id + '-desc'">
                  <UiTextarea 
                    v-model="term.description"
                    :ref="focusElement"
                    @blur="stopEdit"
                    class="text-xs min-h-[40px] resize-none mt-1 w-full p-2 focus-visible:ring-primary/50 border-primary/40"
                    placeholder="添加上下文描述..."
                  />
                </div>
                <div 
                  v-else 
                  @click="startEdit(term.id + '-desc')"
                  class="text-xs text-gray-400 cursor-text hover:bg-black/5 dark:hover:bg-white/5 px-1 py-1 rounded mt-1 transition-colors min-h-[24px] break-words whitespace-pre-wrap"
                >
                  {{ term.description || '点击添加上下文描述...' }}
                </div>
                
                <div class="mt-1.5 flex items-center gap-1.5 px-1">
                  <UiSelect v-model="term.status">
                    <UiSelectTrigger class="w-[90px] h-6 text-xs px-1.5">
                      <UiSelectValue />
                    </UiSelectTrigger>
                    <UiSelectContent class="min-w-[4rem]">
                      <UiSelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value" class="text-xs">
                        {{ opt.label }}
                      </UiSelectItem>
                    </UiSelectContent>
                  </UiSelect>
                  <span class="w-2 h-2 rounded-full" :class="getStatusColor(term.status)"></span>
                </div>
              </div>
            </UiTableCell>

            <!-- 多语言翻译列 -->
            <UiTableCell v-for="lang in targetLanguages" :key="lang.code" class="align-top group p-3">
              <div class="h-full relative min-h-[5rem]">
                <div v-if="activeEditKey === term.id + '-' + lang.code" class="h-full">
                  <UiTextarea 
                    v-model="term.translations[lang.code]"
                    :ref="focusElement"
                    @blur="stopEdit"
                    class="w-full h-full min-h-[5rem] p-2 focus-visible:border-primary text-sm shadow-sm"
                    :placeholder="'输入 ' + lang.name + ' 翻译...'"
                  />
                </div>
                <div 
                  v-else 
                  @click="startEdit(term.id + '-' + lang.code)"
                  class="w-full h-full min-h-[5rem] p-2 rounded-md transition-colors cursor-text text-sm break-words whitespace-pre-wrap border border-transparent hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                  :class="!term.translations[lang.code] ? 'text-gray-400 italic' : 'text-gray-700 dark:text-gray-200'"
                >
                  {{ term.translations[lang.code] || '空' }}
                </div>
              </div>
            </UiTableCell>

          </UiTableRow>
          
          <UiTableRow v-if="filteredTerms.length === 0">
            <UiTableCell :colspan="targetLanguages.length + 2" class="px-4 py-12 text-center text-gray-400 text-sm">
              空空如也，没有找到匹配的词条。
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </div>

    <!-- 导出语言选择模态框 -->
    <UiDialog :open="showExportModal" @update:open="val => { if(!val) closeExportModal() }">
      <UiDialogContent class="sm:max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>选择要导出的语言</UiDialogTitle>
          <UiDialogDescription>
            您可以自定义选择需要被导出成独立配置的语言模块。
          </UiDialogDescription>
        </UiDialogHeader>
        
        <!-- Content -->
        <div class="py-2">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-gray-500 dark:text-gray-400">已选择 {{ selectedExportLangs.length }} / {{ targetLanguages.length }} 项</span>
            <div class="flex gap-2">
              <UiButton variant="link" class="h-auto p-0 text-primary" @click="selectAllExportLangs">全选</UiButton>
              <UiButton variant="link" class="h-auto p-0 text-muted-foreground" @click="deselectAllExportLangs">取消全选</UiButton>
            </div>
          </div>
          
          <UiScrollArea class="h-[40vh] pr-4">
            <div class="grid grid-cols-2 gap-3 pb-4">
              <div
                v-for="lang in targetLanguages" 
                :key="lang.code"
                class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent hover:text-accent-foreground transition select-none"
                :class="selectedExportLangs.includes(lang.code) ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'"
                @click="toggleExportLang(lang.code)"
              >
                <UiCheckbox 
                  :model-value="selectedExportLangs.includes(lang.code)" 
                  class="pointer-events-none shrink-0" 
                />
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-medium truncate">{{ lang.name }}</span>
                  <span class="text-xs opacity-70 truncate">{{ lang.code }}</span>
                </div>
              </div>
            </div>
          </UiScrollArea>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="closeExportModal">取消</UiButton>
          <UiButton @click="confirmExport">
            确认导出 ({{ selectedExportLangs.length }})
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- 侧边栏详情抽屉 (Drawer) -->
    <UiSheet :open="isDrawerOpen" @update:open="val => { if(!val) closeDrawer() }">
      <UiSheetContent class="w-[500px] sm:max-w-[500px] p-0 flex flex-col border-l dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div v-if="activeDrawerTerm" class="flex flex-col h-full overflow-hidden">
          <!-- Drawer Header -->
          <UiSheetHeader class="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50 space-y-0 text-left">
            <div class="flex justify-between items-center w-full min-w-0 pr-6 pl-1">
              <UiSheetTitle class="text-lg font-bold truncate text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span class="text-primary opacity-80 font-mono font-medium" v-if="activeDrawerTerm.module">{{ activeDrawerTerm.module }}.</span>
                <span class="truncate">{{ activeDrawerTerm.key }}</span>
              </UiSheetTitle>
              <UiSelect v-model="activeDrawerTerm.status">
                <UiSelectTrigger class="w-[110px] h-8 text-xs shrink-0 bg-white dark:bg-zinc-900">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>
            <UiSheetDescription class="hidden">详情</UiSheetDescription>
          </UiSheetHeader>

          <div class="flex-1 min-h-0">
            <UiScrollArea class="h-full w-full block">
              <div class="p-6 space-y-8">
          
          <!-- Section: Context & Description -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">上下文描述</h3>
            <UiTextarea 
              v-model="activeDrawerTerm.description"
              class="min-h-[80px]"
              placeholder="添加详细的上下文描述，如出现位置、用途等..."
            />
            
            <!-- 占位截图区域 -->
            <div class="w-full h-32 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition cursor-pointer">
              <Plus class="w-6 h-6 mb-2" />
              <span class="text-xs">上传参考截图 (Mock)</span>
            </div>
          </div>

          <hr class="border-gray-100 dark:border-zinc-800" />

          <!-- Section: All Translations form -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
              多语言翻译
              <span class="text-xs font-normal text-gray-500">{{ targetLanguages.length }} 个语种</span>
            </h3>
            <div class="grid grid-cols-1 gap-4">
              <div v-for="lang in targetLanguages" :key="lang.code" class="group">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex justify-between">
                  <span>{{ lang.name }} <span class="uppercase text-gray-400 translate-y-px inline-block ml-1">({{ lang.code }})</span></span>
                </label>
                <UiTextarea 
                  v-model="activeDrawerTerm.translations[lang.code]"
                  class="min-h-[44px]"
                  :placeholder="'输入 ' + lang.name + ' 翻译...'"
                />
              </div>
            </div>
          </div>

          <hr class="border-gray-100 dark:border-zinc-800" />

          <!-- Section: Meta / History -->
          <div class="space-y-4 pb-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">元数据与日志</h3>
            <div class="bg-gray-50 dark:bg-zinc-950 p-4 rounded-lg space-y-3 text-sm">
              <div class="flex items-center text-gray-500 dark:text-gray-400">
                <CalendarDays class="w-4 h-4 mr-2" />
                <span class="w-20">最后更新:</span>
                <span class="text-gray-900 dark:text-gray-100">{{ activeDrawerTerm.updatedAt || 'N/A' }}</span>
              </div>
              
              <div v-if="activeDrawerTerm.history && activeDrawerTerm.history.length > 0" class="mt-4 border-t border-gray-200 dark:border-zinc-800 pt-3">
                <p class="text-xs text-gray-500 mb-2">最近动态</p>
                <ul class="space-y-3 relative before:absolute before:inset-y-0 before:left-[5px] before:w-[2px] before:bg-gray-200 dark:before:bg-zinc-800">
                  <li v-for="(log, idx) in activeDrawerTerm.history" :key="idx" class="relative pl-5">
                    <span class="absolute left-0 top-1.5 w-3 h-3 bg-white dark:bg-zinc-950 border-[2px] border-primary rounded-full z-10"></span>
                    <div class="flex flex-col text-xs space-y-0.5">
                      <span class="text-gray-900 dark:text-gray-100 font-medium">{{ log.user }} <span class="text-gray-500 font-normal ml-1">{{ log.action }}</span></span>
                      <span class="text-gray-400">{{ log.time }}</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
            </div>
          </UiScrollArea>
          </div>
        </div>
      </UiSheetContent>
    </UiSheet>
  </div>
</template>
