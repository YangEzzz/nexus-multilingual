<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, Plus, Trash2, Search, X, Check, PanelRightClose, CalendarDays } from 'lucide-vue-next'

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
    const matchModule = selectedModule.value === 'all' || term.module === selectedModule.value
    
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

function getStatusLabel(status: string) {
  return statusOptions.find(o => o.value === status)?.label || status
}

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
    alert('请至少选择一种语言导出！')
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
  alert(`已触发 ${langsToExport.length} 个语言文件的下载！`)
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
        <button 
          @click="addNewTerm"
          class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus class="w-4 h-4 mr-2" />
          新建词条
        </button>
        <button 
          @click="openExportModal"
          class="inline-flex items-center px-4 py-2 bg-zinc-800 text-white rounded-md text-sm font-medium hover:bg-zinc-700 transition dark:bg-gray-200 dark:text-zinc-900 dark:hover:bg-gray-300"
        >
          <Download class="w-4 h-4 mr-2" />
          多语言导出...
        </button>
      </div>
    </div>

    <!-- 顶栏过滤器 -->
    <div class="flex gap-4 p-4 bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800">
      <div class="flex-1 relative">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          v-model="searchQuery" 
          placeholder="搜索 Keyword... (例如 confirm)"
          class="w-full pl-9 pr-4 py-2 border rounded-md text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-100 outline-none focus:border-blue-500"
        />
      </div>
      
      <select 
        v-model="selectedModule"
        class="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-100 outline-none focus:border-blue-500"
      >
        <option value="all">所有模块</option>
        <option v-for="mod in modules" :key="mod" :value="mod">{{ mod === '' ? '(无模块)' : mod }}</option>
      </select>

      <select 
        v-model="selectedStatus"
        class="border rounded-md px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-100 outline-none focus:border-blue-500"
      >
        <option value="all">所有状态</option>
        <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- 工作台主区域 -->
    <div class="flex-1 overflow-auto bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800">
      <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
        <thead class="bg-gray-50 dark:bg-zinc-900 text-gray-700 dark:text-gray-200 sticky top-0 z-10 border-b border-gray-200 dark:border-zinc-700">
          <tr>
            <th class="px-4 py-3 font-semibold w-64 min-w-[16rem]">词条 Key & 信息</th>
            <th v-for="lang in targetLanguages" :key="lang.code" class="px-4 py-3 font-semibold min-w-[16rem]">
              {{ lang.name }} <span class="text-xs font-normal text-gray-400">({{ lang.code }})</span>
            </th>
            <th class="px-4 py-3 font-semibold w-24 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="term in filteredTerms" 
            :key="term.id"
            class="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-900/50 transition"
          >
            <!-- 词条基础信息列 -->
            <td class="px-4 py-3 align-top">
              <div class="flex flex-col gap-1.5">
                <!-- Module -->
                <div v-if="activeEditKey === term.id + '-module'">
                  <input 
                    v-model="term.module" 
                    :ref="focusElement"
                    @blur="stopEdit"
                    @keydown.enter="stopEdit"
                    class="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-1 rounded outline-none min-w-[5rem] max-w-full border border-blue-300 dark:border-blue-700 placeholder:text-blue-300 dark:placeholder:text-blue-700 font-medium"
                    placeholder="模块(可选)"
                  />
                </div>
                <div 
                  v-else 
                  @click="startEdit(term.id + '-module')"
                  class="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-1 rounded w-max cursor-text hover:ring-1 hover:ring-blue-300 transition-shadow min-h-[24px] flex items-center"
                >
                  {{ term.module || '无模块' }}
                </div>

                <!-- Key -->
                <div class="flex items-center gap-2">
                  <div v-if="activeEditKey === term.id + '-key'" class="flex-1">
                    <input 
                      v-model="term.key"
                      :ref="focusElement"
                      @blur="stopEdit"
                      @keydown.enter="stopEdit"
                      class="font-semibold text-gray-900 dark:text-gray-100 bg-transparent outline-none border-b border-gray-400 focus:border-blue-500 w-full px-1 py-0.5"
                      placeholder="词条键名"
                    />
                  </div>
                  <div 
                    v-else 
                    @click="openDrawer(term)"
                    class="font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline px-1 py-0.5 rounded transition-colors break-words min-h-[28px] flex-1 flex items-center"
                    title="点击打开详情侧边栏"
                  >
                    {{ term.key || '未命名键值' }}
                  </div>
                </div>

                <!-- Description -->
                <div v-if="activeEditKey === term.id + '-desc'">
                  <textarea 
                    v-model="term.description"
                    :ref="focusElement"
                    @blur="stopEdit"
                    class="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-950 outline-none resize-none mt-1 w-full border border-blue-400 rounded p-1.5 shadow-sm"
                    rows="2"
                    placeholder="添加上下文描述..."
                  ></textarea>
                </div>
                <div 
                  v-else 
                  @click="startEdit(term.id + '-desc')"
                  class="text-xs text-gray-400 cursor-text hover:bg-black/5 dark:hover:bg-white/5 px-1 py-1 rounded mt-1 transition-colors min-h-[24px] break-words whitespace-pre-wrap"
                >
                  {{ term.description || '点击添加上下文描述...' }}
                </div>
                
                <div class="mt-1.5 flex items-center gap-1.5 px-1">
                  <select 
                    v-model="term.status"
                    class="text-xs bg-transparent outline-none border rounded border-gray-200 dark:border-zinc-700 px-1 py-0.5 cursor-pointer"
                  >
                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                  <span class="w-2 h-2 rounded-full" :class="getStatusColor(term.status)"></span>
                </div>
              </div>
            </td>

            <!-- 多语言翻译列 -->
            <td v-for="lang in targetLanguages" :key="lang.code" class="px-4 py-3 align-top group">
              <div class="h-full relative min-h-[5rem]">
                <div v-if="activeEditKey === term.id + '-' + lang.code" class="h-full">
                  <textarea 
                    v-model="term.translations[lang.code]"
                    :ref="focusElement"
                    @blur="stopEdit"
                    class="w-full h-full min-h-[5rem] p-2 bg-white dark:bg-zinc-950 border border-blue-500 rounded-md outline-none resize-y text-sm shadow-sm"
                    :placeholder="'输入 ' + lang.name + ' 翻译...'"
                  ></textarea>
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
            </td>

            <!-- 操作列 -->
            <td class="px-4 py-3 align-top text-center text-gray-400">
              <button 
                @click="deleteTerm(term.id)"
                class="p-1.5 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                title="删除此条词条"
              >
                <Trash2 class="w-4 h-4 mx-auto" />
              </button>
            </td>
          </tr>
          
          <tr v-if="filteredTerms.length === 0">
            <td :colspan="targetLanguages.length + 2" class="px-4 py-12 text-center text-gray-400">
              空空如也，没有找到匹配的词条。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 导出语言选择模态框 -->
    <div v-if="showExportModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">选择要导出的语言</h3>
          <button @click="closeExportModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <!-- Content -->
        <div class="p-5 flex-1 overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-gray-500 dark:text-gray-400">已选择 {{ selectedExportLangs.length }} / {{ targetLanguages.length }} 项</span>
            <div class="flex gap-2">
              <button @click="selectAllExportLangs" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">全选</button>
              <button @click="deselectAllExportLangs" class="text-xs text-gray-500 dark:text-gray-400 hover:underline">取消全选</button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div 
              v-for="lang in targetLanguages" 
              :key="lang.code"
              @click="toggleExportLang(lang.code)"
              class="flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition select-none"
              :class="selectedExportLangs.includes(lang.code) 
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                : 'border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-zinc-700'"
            >
              <div 
                class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                :class="selectedExportLangs.includes(lang.code) ? 'bg-blue-500 text-white' : 'border-2 border-gray-300 dark:border-zinc-600'"
              >
                <Check v-if="selectedExportLangs.includes(lang.code)" class="w-3.5 h-3.5" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-medium truncate">{{ lang.name }}</span>
                <span class="text-xs opacity-70 truncate">{{ lang.code }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-5 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50 rounded-b-xl">
          <button 
            @click="closeExportModal"
            class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition"
          >
            取消
          </button>
          <button 
            @click="confirmExport"
            class="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition"
          >
            确认导出 ({{ selectedExportLangs.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- 侧边栏详情抽屉 (Drawer) -->
    <div 
      v-if="isDrawerOpen" 
      class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" 
      @click="closeDrawer"
    ></div>
    
    <div 
      class="fixed top-0 right-0 h-full w-[500px] max-w-full bg-white dark:bg-zinc-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-zinc-800 flex flex-col"
      :class="isDrawerOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <div v-if="activeDrawerTerm" class="flex flex-col h-full h-full overflow-hidden">
        <!-- Drawer Header -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-zinc-950/50">
          <div class="flex items-center gap-3 w-full min-w-0 pr-4">
            <h2 class="text-lg font-bold truncate text-gray-900 dark:text-gray-100 flex-1 flex items-center gap-2">
              <span class="text-blue-600 dark:text-blue-400 opacity-60 font-mono font-medium" v-if="activeDrawerTerm.module">{{ activeDrawerTerm.module }}.</span>
              <span class="truncate">{{ activeDrawerTerm.key }}</span>
            </h2>
            <select 
              v-model="activeDrawerTerm.status"
              class="text-xs bg-white dark:bg-zinc-900 outline-none border rounded border-gray-200 dark:border-zinc-700 px-2 py-1 cursor-pointer shadow-sm shrink-0"
            >
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <button @click="closeDrawer" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition shrink-0 dark:hover:bg-zinc-800">
            <PanelRightClose class="w-5 h-5" />
          </button>
        </div>

        <!-- Drawer Content (Scrollable) -->
        <div class="p-6 flex-1 overflow-y-auto space-y-8 bg-white dark:bg-zinc-900">
          
          <!-- Section: Context & Description -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">上下文描述</h3>
            <textarea 
              v-model="activeDrawerTerm.description"
              class="w-full min-h-[80px] p-3 text-sm bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-blue-500 rounded-lg outline-none resize-none transition-colors text-gray-600 dark:text-gray-300"
              placeholder="添加详细的上下文描述，如出现位置、用途等..."
            ></textarea>
            
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
                <textarea 
                  v-model="activeDrawerTerm.translations[lang.code]"
                  class="w-full min-h-[44px] p-2.5 text-sm bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md outline-none transition-all shadow-sm resize-y"
                  :placeholder="'输入 ' + lang.name + ' 翻译...'"
                ></textarea>
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
                    <span class="absolute left-0 top-1.5 w-3 h-3 bg-white dark:bg-zinc-950 border-[2px] border-blue-500 rounded-full z-10"></span>
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
      </div>
    </div>
  </div>
</template>
