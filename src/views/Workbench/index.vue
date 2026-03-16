<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Download, Plus, Trash2, Search, CalendarDays, Wand2, Loader2, Upload, Copy, X, ListPlus, Edit3, Save, RotateCcw, ChevronDown } from 'lucide-vue-next'
import { ai } from '@/lib/gemini'
import { toast } from 'vue-sonner'
import * as XLSX from 'xlsx'

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

const defaultTerms: TermItem[] = [
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
]

const savedTerms = localStorage.getItem('nexus-multilingual-terms')
const terms = ref<TermItem[]>(savedTerms ? JSON.parse(savedTerms) : defaultTerms)

// Auto-save changes to localStorage (only when NOT in global edit mode to prevent partial saves)
watch(terms, (newVal) => {
  if (!isGlobalEditing.value) {
    localStorage.setItem('nexus-multilingual-terms', JSON.stringify(newVal))
  }
}, { deep: true })

const isGlobalEditing = ref(false)
const originalTermsJson = ref('')

function enterEditMode() {
  if (selectedTermIds.value.length === 0) {
    toast.info('操作提示', { 
      description: '请先勾选左侧复选框，选中需要编辑的词条后再进入编辑模式。',
      action: {
        label: '知道了',
        onClick: () => {}
      }
    })
    return
  }
  originalTermsJson.value = JSON.stringify(terms.value)
  isGlobalEditing.value = true
}

function saveEditMode() {
  // Persistence happens via watch on false -> true transition or manual here
  localStorage.setItem('nexus-multilingual-terms', JSON.stringify(terms.value))
  isGlobalEditing.value = false
  toast.success('保存成功', { description: '所有变更已同步到本地存储。' })
}

function discardEditMode() {
  terms.value = JSON.parse(originalTermsJson.value)
  isGlobalEditing.value = false
  toast.info('已放弃更改', { description: '数据已回滚到编辑前的状态。' })
}

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
    key: '', // Default empty to trigger the 'draft -> pending' flow
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
  // After adding, select the new item and ensure we are in edit mode
  const newId = terms.value[0]?.id
  if (newId && !selectedTermIds.value.includes(newId)) {
    selectedTermIds.value = [newId, ...selectedTermIds.value]
  }
  if (!isGlobalEditing.value) {
    enterEditMode()
  }
}

function deleteTerm(id: string) {
  terms.value = terms.value.filter(t => t.id !== id)
}

const translatingTerms = ref(new Set<string>())
// 翻译确认弹窗状态
const tempPrompt = ref('')

function cancelTranslateDialog() {
  pendingBatchTranslate.value = false
  tempPrompt.value = ''
}

async function confirmTranslate() {
  const prompt = tempPrompt.value
  pendingBatchTranslate.value = false
  tempPrompt.value = ''
  await batchTranslate(prompt)
}

async function translateRow(term: TermItem, customPrompt?: string) {
  if (translatingTerms.value.has(term.id)) return
  if (!term.key) {
    toast.error('翻译失败', { description: '请先填写词条 Key 以后再进行翻译。' })
    return
  }
  
  translatingTerms.value.add(term.id)
  try {
    // 格式指令（系统固定，不暴露给用户修改）
    const systemInstruction = `\n\n格式要求：你必须返回一个合法的 JSON 对象。不要返回任何 Markdown 标记符（如 \`\`\`json ），不要返回任何解释。JSON 键名必须严格是以下代号：${targetLanguages.value.map(l => l.code).join(', ')}，对应的值为各语言翻译后的文本。若某语言不知如何翻译，返回空字符串 "".`

    // 构建用户提示词（支持外部注入已渲染的自定义提示词）
    let userPrompt: string
    if (customPrompt) {
      // 来自弹窗的临时提示词（已注入变量）
      userPrompt = customPrompt
    } else {
      // 批量翻译时走这里，直接用全局提示词并注入变量
      const translationsStr = Object.entries(term.translations)
        .filter(([_, val]) => val)
        .map(([lang, val]) => `${lang}: ${val}`)
        .join('\n')
      userPrompt = globalPrompt.value
        .replace('{description}', term.description || '无')
        .replace('{translations}', translationsStr || '无')
    }

    const fullPrompt = userPrompt + systemInstruction

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: { temperature: 0.2 }
    })

    const result = response.text?.trim() || ''
    const cleanJsonStr = result.replace(/^```json/gi, '').replace(/^```/g, '').replace(/```$/g, '').trim()
    
    let translatedData = {}
    try {
      translatedData = JSON.parse(cleanJsonStr)
    } catch(e) {
      console.error('Failed to parse JSON from AI response:', cleanJsonStr)
      throw new Error('AI 返回的数据格式无法解析为 JSON')
    }

    targetLanguages.value.forEach(lang => {
      if (translatedData[lang.code as keyof typeof translatedData] !== undefined) {
        term.translations[lang.code] = translatedData[lang.code as keyof typeof translatedData]
      }
    })

    if (!term.history) term.history = []
    term.history.unshift({
      time: new Date().toLocaleString(),
      action: '使用了 AI 进行了全语言自动翻译',
      user: 'AI 助理'
    })
    term.status = 'review'
    term.updatedAt = new Date().toLocaleString()

  } catch (error) {
    console.error('AI 翻译失败:', error)
    toast.error('AI 翻译失败', { description: '请检查控制台或网络配置。' })
  } finally {
    translatingTerms.value.delete(term.id)
  }
}

const selectedTermIds = ref<string[]>([])
const isBatchTranslating = ref(false)
const showBatchDeleteDialog = ref(false)
const showSettingsModal = ref(false)
const pendingBatchTranslate = ref(false) // 批量自定义提示词弹窗状态
const globalPrompt = ref(`翻译以下内容，这是一个智能体APP的内容并将其翻译为本地化语言。
待翻译原文参考：
描述和上下文: {description}
现有参考翻译 (若有可参考，若无请根据键名和描述推断):
{translations}`)

const isAllSelected = computed(() => {
  return filteredTerms.value.length > 0 && selectedTermIds.value.length === filteredTerms.value.length
})

const isIndeterminate = computed(() => {
  return selectedTermIds.value.length > 0 && selectedTermIds.value.length < filteredTerms.value.length
})

const checkboxAllState = computed(() => {
  if (isAllSelected.value) return true
  if (isIndeterminate.value) return 'indeterminate'
  return false
})

function toggleSelectTerm(id: string, checked: any) {
  const isChecked = checked === true || checked === 'true'
  if (isChecked) {
    if (!selectedTermIds.value.includes(id)) {
      selectedTermIds.value = [...selectedTermIds.value, id]
    }
  } else {
    selectedTermIds.value = selectedTermIds.value.filter(i => i !== id)
  }
}

function handleSelectAll(checked: any) {
  const isChecked = checked === true || checked === 'true'
  if (isChecked) {
    selectedTermIds.value = filteredTerms.value.map(t => t.id)
  } else {
    selectedTermIds.value = []
  }
}

async function batchTranslate(customPrompt?: string) {
  if (selectedTermIds.value.length === 0) return
  isBatchTranslating.value = true
  let successCount = 0
  let failCount = 0

  // 并发请求数量控制 (控制在3个以内避免超出 AI API 频率限制)
  const batchSize = 3
  for (let i = 0; i < selectedTermIds.value.length; i += batchSize) {
    const batchList = selectedTermIds.value.slice(i, i + batchSize)
    const promises = batchList.map(async (id) => {
      const term = terms.value.find(t => t.id === id)
      if (term) {
        try {
          // 如果有自定义提示词，需居中注入当前词条的变量
          let termPrompt: string | undefined
          if (customPrompt) {
            const translationsStr = Object.entries(term.translations)
              .filter(([_, val]) => val)
              .map(([lang, val]) => `${lang}: ${val}`)
              .join('\n')
            termPrompt = customPrompt
              .replace('{description}', term.description || '无')
              .replace('{translations}', translationsStr || '无')
          }
          await translateRow(term, termPrompt)
          successCount++
        } catch (error) {
          failCount++
        }
      }
    })
    await Promise.all(promises)
  }

  isBatchTranslating.value = false
  
  if (failCount > 0) {
    toast.warning('批量翻译完成', {
      description: `成功: ${successCount}，失败: ${failCount}。可能是 AI 响应超时或由于并发限制导致。`
    })
  } else {
    toast.success('批量翻译成功', {
      description: `已成功为您翻译了 ${successCount} 个选中的词条。`
    })
  }
}

function openBatchTranslateDialog() {
  if (selectedTermIds.value.length === 0) return
  // 预填全局提示词（保留变量占位符，因为批量时每个词条居中注入）
  tempPrompt.value = globalPrompt.value
  pendingBatchTranslate.value = true
}

function batchDelete() {
  if (selectedTermIds.value.length === 0) {
    toast.info('请先选择要删除的词条')
    return
  }
  showBatchDeleteDialog.value = true
}

function confirmBatchDelete() {
  const count = selectedTermIds.value.length
  terms.value = terms.value.filter(t => !selectedTermIds.value.includes(t.id))
  selectedTermIds.value = []
  showBatchDeleteDialog.value = false
  toast.success('批量删除成功', {
    description: `已删除 ${count} 个词条。`
  })
}

// Removed activeEditKey and startEdit/stopEdit as they are replaced by Global Edit Mode

function handleKeyUpdate(term: TermItem) {
  if (term.key && term.key.trim() !== '') {
    if (term.status === 'draft') {
      term.status = 'pending'
    }
  } else {
    term.status = 'draft'
  }
}

function handleTranslationUpdate(term: TermItem) {
  if (term.status === 'published') {
    term.status = 'review'
  }
}

const showBatchAddModal = ref(false)
const batchAddText = ref('')

function confirmBatchAdd() {
  if (!batchAddText.value.trim()) {
    showBatchAddModal.value = false
    return
  }

  const lines = batchAddText.value.split('\n').filter(line => line.trim())
  const newItems: TermItem[] = []

  lines.forEach(line => {
    const text = line.trim()
    const hasChinese = /[\u4e00-\u9fa5]/.test(text)
    
    newItems.push({
      id: (Date.now() + Math.random()).toString(),
      module: '',
      key: '', // Key left empty for user to fill
      description: '',
      status: 'draft',
      translations: targetLanguages.value.reduce((acc, lang) => {
        // Decide which language column to fill
        if (hasChinese && lang.code === 'cn') {
          acc[lang.code] = text
        } else if (!hasChinese && lang.code === 'en') {
          acc[lang.code] = text
        } else {
          acc[lang.code] = ''
        }
        return acc
      }, {} as Translation),
      updatedAt: new Date().toLocaleString(),
      history: [
        { time: new Date().toLocaleString(), action: '通过快捷批量创建录入', user: '当前用户' }
      ]
    })
  })

  terms.value = [...newItems, ...terms.value]
  
  // Select all newly added items and enter edit mode
  selectedTermIds.value = [...newItems.map(item => item.id), ...selectedTermIds.value]
  if (!isGlobalEditing.value) {
    enterEditMode()
  }
  
  toast.success('批量创建成功', {
    description: `已成功创建 ${newItems.length} 个词条，已为您自动开启选中行的编辑模式。`
  })

  batchAddText.value = ''
  showBatchAddModal.value = false
}

// Focus logic removed as part of Global Edit Mode cleanup

const showExportModal = ref(false)
const selectedExportLangs = ref<string[]>([])
const isDrawerOpen = ref(false)
const activeDrawerTerm = ref<TermItem | null>(null)
const backupDrawerTermJson = ref('')
const presentDeletingId = ref<string | null>(null)

function openDrawer(term: TermItem) {
  activeDrawerTerm.value = term
  backupDrawerTermJson.value = JSON.stringify(term)
  isDrawerOpen.value = true
}

function saveDrawer() {
  if (activeDrawerTerm.value) {
    activeDrawerTerm.value.updatedAt = new Date().toLocaleString()
    if (!activeDrawerTerm.value.history) activeDrawerTerm.value.history = []
    activeDrawerTerm.value.history.unshift({
      time: new Date().toLocaleString(),
      action: '在详情面板手动更新了内容',
      user: '当前用户'
    })
    
    // Key update flow
    handleKeyUpdate(activeDrawerTerm.value)
    
    toast.success('更新成功', { description: '词条详情已保存。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
  }
}

function closeDrawer() {
  if (activeDrawerTerm.value && backupDrawerTermJson.value) {
    // Restore from backup
    const original = JSON.parse(backupDrawerTermJson.value)
    Object.assign(activeDrawerTerm.value, original)
  }
  isDrawerOpen.value = false
  activeDrawerTerm.value = null
}

const excelFileInput = ref<HTMLInputElement | null>(null)

function triggerExcelImport() {
  excelFileInput.value?.click()
}

async function handleExcelImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      toast.error('导入失败', { description: '无法读取 Excel 的工作表。' })
      return
    }
    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      toast.error('导入失败', { description: '找不到该工作表。' })
      return
    }
    
    // Parse as 2D array
    const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    if (json.length < 2) {
      toast.error('导入失败', { description: '未检测到有效数据或语言标识头。' })
      return
    }

    const header = json[0] || []
    // Filter only columns where the header matches an existing language code
    const langIdxMap = new Map<number, string>()
    header.forEach((col: string, idx: number) => {
      if (col && typeof col === 'string') {
        const code = col.trim().toLowerCase()
        if (targetLanguages.value.some(l => l.code === code)) {
          langIdxMap.set(idx, code)
        }
      }
    })

    if (langIdxMap.size === 0) {
      toast.error('导入失败', { description: '第一行无法识别任何支持的语言代码(如 cn, en)。' })
      return
    }

    let importedCount = 0

    // Loop through remaining rows
    for (let i = 1; i < json.length; i++) {
      const row = json[i]
      if (!row || row.length === 0) continue
      
      // Check if row has any valid translation text
      const hasContent = Array.from(langIdxMap.keys()).some(idx => row[idx] && String(row[idx]).trim() !== '')
      if (!hasContent) continue

      const newTerm: TermItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        module: '',
        key: '', // Default empty key, will prompt user to set it
        description: '',
        status: 'draft',
        translations: targetLanguages.value.reduce((acc, lang) => {
          acc[lang.code] = ''
          return acc
        }, {} as Translation),
        updatedAt: new Date().toLocaleString(),
        history: [
          { time: new Date().toLocaleString(), action: '由 Excel 批量导入翻译', user: '当前用户' }
        ]
      }

      // Populate valid fields from row mapping
      langIdxMap.forEach((langCode, idx) => {
        if (row[idx] !== undefined && row[idx] !== null) {
          newTerm.translations[langCode] = String(row[idx]).trim()
        }
      })

      terms.value.unshift(newTerm)
      importedCount++
    }

    toast.success('导入成功', { description: `成功从 Excel 导入了 ${importedCount} 条记录！` })

  } catch (error) {
    console.error(error)
    toast.error('导入失败', { description: 'Excel解析出现异常。' })
  } finally {
    // Reset file input so same file can be imported again if needed
    if (target) target.value = ''
  }
}


// Side drawer functions already defined above

// Default exclusions: 'tr' (土耳其语), 'bn' (孟加拉语), 'pl' (波兰语), 'it' (意大利语)
const defaultExcludedLangs = ['tr', 'bn', 'pl', 'it']

async function copyLangJson(langCode: string, langName: string) {
  const exportData: Record<string, string> = {}
  
  // Fix reactivity in dialog component context
  const hasSelected = Array.isArray(selectedTermIds.value) && selectedTermIds.value.length > 0
  const itemsToExport = hasSelected
    ? terms.value.filter(term => selectedTermIds.value.includes(term.id))
    : filteredTerms.value

  console.log(`[Copy JSON] Mode: ${hasSelected ? 'Selected Rows' : 'All Filtered Rows'}`, itemsToExport)

  if (!itemsToExport || itemsToExport.length === 0) {
    toast.warning('剪贴板提取失败', { description: '抱歉，当前页面或选中列表中没有词条供导出。' })
    return
  }

  itemsToExport.forEach(term => {
    const fullKey = term.module ? `${term.module}.${term.key}` : term.key
    exportData[fullKey] = term.translations[langCode] || ''
  })

  try {
    // 采用正确的方法组装 JSON 内部项字符串
    const lines = Object.entries(exportData).map(([key, val]) => {
      return `  ${JSON.stringify(key)}: ${JSON.stringify(val)}`
    })
    const jsonStr = lines.join(',\n')
    
    // Fallback for non-HTTPS (like local network IP) where navigator.clipboard is undefined
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(jsonStr)
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = jsonStr
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (!successful) throw new Error('Fallback copy command failed')
    }

    toast.success('复制成功', {
      description: `已成功复制【${langName}】的所有词条配置 JSON！`
    })
  } catch (error) {
    console.error('Failed to copy:', error)
    toast.error('复制失败', {
      description: '写入剪贴板失败，请检查浏览器权限。'
    })
  }
}

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
    
    // Fix reactivity in dialog component context
    const hasSelected = Array.isArray(selectedTermIds.value) && selectedTermIds.value.length > 0
    const itemsToExport = hasSelected
      ? terms.value.filter(term => selectedTermIds.value.includes(term.id))
      : filteredTerms.value

    console.log(`[Export File - ${lang.code}] Mode: ${hasSelected ? 'Selected Rows' : 'All Filtered Rows'}`, itemsToExport)

    if (!itemsToExport || itemsToExport.length === 0) {
      toast.warning('文件生成失败', { description: '抱歉，当前页面或选中列表中没有可以导出的有效词条。' })
      return
    }

    itemsToExport.forEach(term => {
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
        <input 
          type="file" 
          ref="excelFileInput" 
          accept=".xlsx, .xls, .csv" 
          class="hidden" 
          @change="handleExcelImport" 
        />
        <UiButton 
          variant="outline"
          @click="triggerExcelImport"
        >
          <Upload class="w-4 h-4 mr-2" />
          导入 Excel
        </UiButton>
        <UiButton 
          variant="outline"
          @click="showBatchAddModal = true"
          :disabled="isGlobalEditing"
        >
          <ListPlus class="w-4 h-4 mr-2" />
          快捷批量创建
        </UiButton>
        
        <UiButton 
          v-if="!isGlobalEditing"
          variant="secondary"
          @click="enterEditMode"
          class="border-primary/20 text-primary hover:bg-primary/5"
        >
          <Edit3 class="w-4 h-4 mr-2" />
          进入编辑模式
        </UiButton>
        
        <div v-else class="flex gap-2 p-1 bg-primary/10 rounded-lg border border-primary/20 animate-in fade-in zoom-in duration-200">
          <UiButton 
            variant="ghost"
            size="sm"
            @click="discardEditMode"
            class="text-muted-foreground hover:text-destructive"
          >
            <RotateCcw class="w-4 h-4 mr-2" />
            放弃
          </UiButton>
          <UiButton 
            variant="default"
            size="sm"
            @click="saveEditMode"
            class="shadow-sm"
          >
            <Save class="w-4 h-4 mr-2" />
            保存全部
          </UiButton>
        </div>

        <UiButton 
          variant="default"
          @click="addNewTerm"
          :disabled="isGlobalEditing"
        >
          <Plus class="w-4 h-4 mr-2" />
          新建词条
        </UiButton>
        <UiButton
          @click="openExportModal"
          class="bg-green-500 hover:bg-green-600 text-white"
          data-hmr-trigger="1"
        >
          <Download class="w-4 h-4" />
          多语言导出
        </UiButton>
      </div>
    </div>

    <!-- 顶栏过滤器和批量操作栏 -->
    <div class="flex flex-col gap-4 p-4 bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800">
      <div class="flex gap-4">
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

        <UiSeparator orientation="vertical" class="h-6 mx-1" />

        <UiTooltipProvider>
          <UiTooltip>
            <UiTooltipTrigger as-child>
              <UiButton variant="outline" size="icon" class="h-9 w-9 shrink-0" @click="showSettingsModal = true">
                <Edit3 class="w-4 h-4" />
              </UiButton>
            </UiTooltipTrigger>
            <UiTooltipContent>全局提示词配置</UiTooltipContent>
          </UiTooltip>
        </UiTooltipProvider>
      </div>

      <!-- 批量操作悬浮栏 (Floating bulk actions) -->
      <div 
        :class="[
          'fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-xl transition-all duration-300 ease-out flex items-center',
          selectedTermIds.length > 0 ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
        ]"
      >
        <div
          class="p-2 shadow-xl rounded-xl border bg-background/95 supports-backdrop-filter:bg-background/60 backdrop-blur-lg flex items-center gap-x-2"
        >
          <UiTooltipProvider>
            <UiTooltip>
              <UiTooltipTrigger as-child>
                <UiButton
                  variant="outline"
                  size="icon"
                  class="size-6 rounded-full"
                  aria-label="取消选中"
                  title="取消选中"
                  @click="selectedTermIds = []"
                >
                  <X class="size-3.5" />
                  <span class="sr-only">取消选中的项</span>
                </UiButton>
              </UiTooltipTrigger>
              <UiTooltipContent>
                <p>取消选中</p>
              </UiTooltipContent>
            </UiTooltip>
          </UiTooltipProvider>

          <UiSeparator class="h-5 mx-1" orientation="vertical" />

          <section class="flex items-center gap-x-1 text-sm whitespace-nowrap">
            <UiBadge
              class="min-w-8 justify-center rounded-lg"
              :aria-label="`${selectedTermIds.length} 已选中`"
            >
              {{ selectedTermIds.length }}
            </UiBadge>
            项已选中
          </section>

          <UiSeparator class="h-5 mx-1" orientation="vertical" />

          <div class="flex items-center gap-x-2">
            <!-- Split Batch Translate Button -->
            <div class="inline-flex items-center rounded-md shadow-sm">
              <UiButton variant="default" size="sm" @click="batchTranslate()" :disabled="isBatchTranslating" class="rounded-r-none">
                <Loader2 v-if="isBatchTranslating" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <Wand2 v-else class="w-3.5 h-3.5 mr-1.5" />
                AI 批量翻译
              </UiButton>
              <UiTooltipProvider>
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <UiButton variant="default" size="sm" @click="openBatchTranslateDialog" :disabled="isBatchTranslating" class="rounded-l-none border-l border-primary-foreground/20 px-1.5">
                      <ChevronDown class="w-3.5 h-3.5" />
                    </UiButton>
                  </UiTooltipTrigger>
                  <UiTooltipContent>自定义提示词批量翻译</UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </div>
            <UiButton variant="destructive" size="sm" @click="batchDelete">
              <Trash2 class="w-3.5 h-3.5 mr-1.5" />
              批量删除
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 词条表格 -->
    <div class="flex-1 overflow-hidden rounded-lg border border-gray-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-950">
      <UiTable class="relative">
        <UiTableHeader class="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-900">
          <UiTableRow>
            <UiTableHead class="w-10 text-center px-3">
              <UiCheckbox 
                :modelValue="checkboxAllState"
                @update:modelValue="handleSelectAll"
                aria-label="Select all"
              />
            </UiTableHead>
            <UiTableHead class="w-16 text-center">操作</UiTableHead>
            <UiTableHead class="min-w-[240px]">Key & Info</UiTableHead>
            <UiTableHead class="w-28 text-center">状态</UiTableHead>
            <UiTableHead v-for="lang in targetLanguages" :key="lang.code" class="min-w-[200px]">
              {{ lang.name }} <span class="text-[10px] opacity-50 font-mono">({{ lang.code }})</span>
            </UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          <UiTableRow 
            v-for="term in filteredTerms" 
            :key="term.id"
            class="group hover:bg-gray-50/50 dark:hover:bg-zinc-900/50 transition-colors border-b border-gray-100 dark:border-zinc-800"
            :class="{ 'bg-primary/[0.03] dark:bg-primary/[0.05]': selectedTermIds.includes(term.id) }"
          >
            <!-- 多选列 -->
            <UiTableCell class="align-top text-center px-3 py-3 w-10">
              <UiCheckbox 
                :modelValue="selectedTermIds.includes(term.id)"
                @update:modelValue="toggleSelectTerm(term.id, $event)"
                aria-label="Select row"
              />
            </UiTableCell>
            
            <!-- 操作列 -->
            <UiTableCell class="align-top text-center p-2 w-20">
              <UiTooltipProvider>
                <div class="flex items-center justify-center gap-1.5 pt-1">
                  <!-- Translate Button -->
                  <UiTooltip>
                    <UiTooltipTrigger as-child>
                      <button 
                        @click="translateRow(term)"
                        :disabled="translatingTerms.has(term.id)"
                        class="p-1.5 hover:text-primary hover:bg-primary/10 rounded-md transition-all disabled:opacity-30 text-primary/70"
                      >
                        <Loader2 v-if="translatingTerms.has(term.id)" class="w-3.5 h-3.5 animate-spin" />
                        <Wand2 v-else class="w-3.5 h-3.5" />
                      </button>
                    </UiTooltipTrigger>
                    <UiTooltipContent side="right">AI 翻译</UiTooltipContent>
                  </UiTooltip>
                  
                  <UiAlertDialog @update:open="val => presentDeletingId = val ? term.id : null">
                    <UiTooltip :open="presentDeletingId === term.id ? false : undefined">
                      <UiTooltipTrigger as-child>
                        <UiAlertDialogTrigger as-child>
                          <button class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all">
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </UiAlertDialogTrigger>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="right">删除词条</UiTooltipContent>
                    </UiTooltip>
                    
                    <UiAlertDialogContent @close-auto-focus="(e) => e.preventDefault()">
                      <UiAlertDialogHeader>
                        <UiAlertDialogTitle>确认删除该词条吗？</UiAlertDialogTitle>
                        <UiAlertDialogDescription>
                          您正在尝试删除词条 <strong class="text-foreground font-mono">{{ term.key }}</strong>。此操作无法撤销。
                        </UiAlertDialogDescription>
                      </UiAlertDialogHeader>
                      <UiAlertDialogFooter>
                        <UiAlertDialogCancel>取消</UiAlertDialogCancel>
                        <UiAlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="deleteTerm(term.id)">
                          确认删除
                        </UiAlertDialogAction>
                      </UiAlertDialogFooter>
                    </UiAlertDialogContent>
                  </UiAlertDialog>
                </div>
              </UiTooltipProvider>
            </UiTableCell>

            <!-- 词条基础信息列 (Optimized Layout) -->
            <UiTableCell class="align-top p-3 min-w-[280px]" :class="{ 'bg-primary/[0.02]': isGlobalEditing && selectedTermIds.includes(term.id) }">
              <div class="flex flex-col gap-1 min-w-0">
                <!-- Row 1: Module & Key & Sidebar Toggle -->
                <div class="flex items-center gap-1.5 min-w-0 h-6">
                  <template v-if="isGlobalEditing && selectedTermIds.includes(term.id)">
                    <div class="flex items-center gap-1 flex-1 min-w-0">
                      <UiInput 
                        v-model="term.module" 
                        class="h-6 w-16 text-[10px] font-mono text-primary bg-background border-primary/20 shrink-0 px-1"
                        placeholder="模块"
                      />
                      <UiInput 
                        v-model="term.key"
                        @update:model-value="handleKeyUpdate(term)"
                        class="h-6 flex-1 text-xs font-bold border-b border-t-0 border-l-0 border-r-0 border-primary/30 focus-visible:ring-0 px-1 py-0 shadow-none rounded-none placeholder:text-red-400 bg-transparent"
                        placeholder="Key不可为空"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex items-center gap-1.5 min-w-0 flex-1">
                      <span v-if="term.module" class="text-[9px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1 py-0.5 rounded shrink-0 border border-primary/5">
                        {{ term.module }}
                      </span>
                      <span class="font-bold text-[13px] text-gray-900 dark:text-gray-100 truncate flex-1" :title="term.key">
                        {{ term.key || 'Untitled_Key' }}
                      </span>
                    </div>
                  </template>
                  
                  <button 
                    @click="openDrawer(term)"
                    class="p-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="配置详情"
                  >
                    <Search class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Row 2: Subtle Description -->
                <div class="min-w-0 h-5">
                  <template v-if="isGlobalEditing && selectedTermIds.includes(term.id)">
                    <UiInput 
                      v-model="term.description"
                      class="h-5 text-[10px] w-full px-1 border-gray-100 dark:border-zinc-800 bg-background/50 focus:bg-background"
                      placeholder="添加描述..."
                    />
                  </template>
                  <template v-else-if="term.description">
                    <p class="text-[11px] text-gray-400 line-clamp-1 italic px-0.5 leading-tight truncate" :title="term.description">
                      {{ term.description }}
                    </p>
                  </template>
                </div>
              </div>
            </UiTableCell>

            <!-- 状态列 -->
            <UiTableCell class="align-top p-3 text-center w-32" :class="{ 'bg-primary/[0.02]': isGlobalEditing && selectedTermIds.includes(term.id) }">
              <div class="flex justify-center pt-1">
                <template v-if="isGlobalEditing && selectedTermIds.includes(term.id)">
                  <UiSelect v-model="term.status">
                    <UiSelectTrigger class="w-[100px] h-7 text-[11px] px-2 bg-background border-primary/20">
                      <div class="flex items-center gap-1.5 truncate">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="getStatusColor(term.status)"></span>
                        <UiSelectValue />
                      </div>
                    </UiSelectTrigger>
                    <UiSelectContent>
                      <UiSelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value" class="text-xs">
                        <div class="flex items-center gap-2">
                          <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="opt.color"></span>
                          {{ opt.label }}
                        </div>
                      </UiSelectItem>
                    </UiSelectContent>
                  </UiSelect>
                </template>
                <template v-else>
                  <div 
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium shadow-sm transition-all"
                    :class="[
                      term.status === 'draft' ? 'bg-slate-50 text-slate-600 border-slate-200' : 
                      term.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      term.status === 'review' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    ]"
                  >
                    <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="getStatusColor(term.status)" v-if="term.status === 'pending' || term.status === 'review'"></span>
                    <span class="w-1.5 h-1.5 rounded-full" :class="getStatusColor(term.status)" v-else></span>
                    {{ statusOptions.find(o => o.value === term.status)?.label }}
                  </div>
                </template>
              </div>
            </UiTableCell>

            <!-- 多语言翻译列 -->
            <UiTableCell v-for="lang in targetLanguages" :key="lang.code" class="align-top p-2 group/cell" :class="{ 'bg-primary/[0.01]': isGlobalEditing && selectedTermIds.includes(term.id) }">
              <div class="min-h-[44px] relative">
                <template v-if="isGlobalEditing && selectedTermIds.includes(term.id)">
                  <UiTextarea 
                    v-model="term.translations[lang.code]"
                    @update:model-value="handleTranslationUpdate(term)"
                    class="w-full min-h-[44px] p-1.5 text-xs shadow-none bg-background border-primary/20 focus-visible:ring-1 focus-visible:ring-primary/20 resize-none transition-all leading-relaxed"
                    :placeholder="'输入 ' + lang.name + '...'"
                  />
                </template>
                <template v-else>
                  <div 
                    class="w-full min-h-[44px] p-1.5 text-xs break-words whitespace-pre-wrap rounded border border-transparent transition-colors group-hover/cell:bg-gray-50/80"
                    :class="!term.translations[lang.code] ? 'text-gray-300 italic' : 'text-gray-700 dark:text-gray-300'"
                  >
                    {{ term.translations[lang.code] || 'Empty' }}
                  </div>
                </template>
              </div>
            </UiTableCell>

          </UiTableRow>
          
          <UiTableRow v-if="filteredTerms.length === 0">
            <UiTableCell :colspan="targetLanguages.length + 4" class="px-4 py-12 text-center text-gray-400 text-sm">
              空空如也，没有找到匹配的词条。
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </div>

    <!-- 快捷批量创建模态框 -->
    <UiDialog :open="showBatchAddModal" @update:open="val => showBatchAddModal = val">
      <UiDialogContent class="sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle>快捷批量创建词条</UiDialogTitle>
          <UiDialogDescription>
            每行输入一个你要翻译的文本内容。如果包含中文字符，将自动填入“中文”列；否则将填入“英文”列。
          </UiDialogDescription>
        </UiDialogHeader>
        
        <div class="py-4">
          <UiLabel class="mb-2 block text-gray-500 text-xs">粘贴你的清单，一行一条：</UiLabel>
          <UiTextarea 
            v-model="batchAddText"
            placeholder="例如：
确认删除吗？
Please confirm your action
Settings
系统设置"
            class="min-h-[300px] font-mono text-sm p-4 leading-relaxed"
          />
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="showBatchAddModal = false">取消</UiButton>
          <UiButton @click="confirmBatchAdd" :disabled="!batchAddText.trim()">确认并创建</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

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
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-sm font-medium truncate">{{ lang.name }}</span>
                  <span class="text-xs opacity-70 truncate">{{ lang.code }}</span>
                </div>
                <UiTooltipProvider>
                  <UiTooltip>
                    <UiTooltipTrigger as-child>
                      <button 
                        @click.stop="copyLangJson(lang.code, lang.name)"
                        class="p-1.5 ml-auto text-muted-foreground hover:bg-background hover:text-foreground rounded transition border border-transparent hover:border-border shadow-sm shadow-transparent hover:shadow-sm"
                      >
                        <Copy class="w-4 h-4" />
                      </button>
                    </UiTooltipTrigger>
                    <UiTooltipContent>直接复制 JSON</UiTooltipContent>
                  </UiTooltip>
                </UiTooltipProvider>
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
          <div class="space-y-4">
            <div class="space-y-2">
              <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">上下文描述</h3>
              <UiTextarea 
                v-model="activeDrawerTerm.description"
                class="min-h-[80px] text-sm leading-relaxed"
                placeholder="添加详细的上下文描述，如出现位置、用途等..."
              />
            </div>
            
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
                  @update:model-value="handleTranslationUpdate(activeDrawerTerm)"
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

          <div class="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-3 sticky bottom-0">
            <UiButton variant="outline" @click="closeDrawer">取消</UiButton>
            <UiButton @click="saveDrawer">保存修改</UiButton>
          </div>
        </div>
      </UiSheetContent>
    </UiSheet>

    <!-- 全局提示词设置模态框 -->
    <UiDialog :open="showSettingsModal" @update:open="val => showSettingsModal = val">
      <UiDialogContent class="sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle class="flex items-center gap-2">
            <Wand2 class="w-5 h-5 text-primary" />
            AI 翻译提示词配置
          </UiDialogTitle>
          <UiDialogDescription>
            您可以自定义 AI 翻译时的指令逻辑。使用变量占位符来动态注入内容。
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <UiLabel class="text-sm font-bold flex justify-between items-center">
              全局默认提示词 (Default Prompt)
              <UiButton variant="ghost" size="sm" @click="globalPrompt = '翻译以下内容，这是一个智能体APP的内容并将其翻译为本地化语言。\n待翻译原文参考：\n描述和上下文: {description}\n现有参考翻译 (若有可参考，若无请根据键名和描述推断):\n{translations}'" class="h-6 text-[10px] text-muted-foreground hover:text-primary">
                恢复默认
              </UiButton>
            </UiLabel>
            <UiTextarea 
              v-model="globalPrompt"
              class="min-h-[220px] font-mono text-sm leading-relaxed p-4"
              placeholder="输入翻译指令..."
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800">
              <p class="text-xs font-bold text-gray-500 mb-2 uppercase">可用变量</p>
              <div class="space-y-1.5">
                <div class="flex justify-between items-center group">
                  <code class="text-[11px] text-primary bg-primary/5 px-1 rounded">{description}</code>
                  <span class="text-[10px] text-gray-400">词条的上下文描述</span>
                </div>
                <div class="flex justify-between items-center group">
                  <code class="text-[11px] text-primary bg-primary/5 px-1 rounded">{translations}</code>
                  <span class="text-[10px] text-gray-400">当前已有的翻译参考</span>
                </div>
              </div>
            </div>
            <div class="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-100/50 dark:border-amber-900/30">
              <p class="text-xs font-bold text-amber-600 mb-2 uppercase flex items-center gap-1">
                <Search class="w-3 h-3" /> 注意事项
              </p>
              <p class="text-[10px] text-amber-700/80 leading-relaxed">
                系统会自动在提示词末尾添加 JSON 格式化指令。您无需重复定义 JSON 结构，只需关注翻译的质量、风格和术语要求。
              </p>
            </div>
          </div>
        </div>

        <UiDialogFooter>
          <UiButton @click="showSettingsModal = false">完成配置</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- AI 批量翻译自定义提示词弹窗 -->
    <UiDialog :open="pendingBatchTranslate" @update:open="val => { if (!val) cancelTranslateDialog() }">
      <UiDialogContent class="sm:max-w-xl">
        <UiDialogHeader>
          <UiDialogTitle class="flex items-center gap-2">
            <Wand2 class="w-4 h-4 text-primary" />
            AI 批量翻译
            <span class="text-sm font-normal text-muted-foreground">— {{ selectedTermIds.length }} 个词条</span>
          </UiDialogTitle>
          <UiDialogDescription>
            以下是将应用到所有选中词条的提示词模板，变量将为每条词条自动填入。
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-2 py-2">
          <UiTextarea
            v-model="tempPrompt"
            class="min-h-[180px] font-mono text-sm leading-relaxed p-3 bg-gray-50/50 dark:bg-zinc-900/50"
            placeholder="输入或修改提示词..."
          />
          <p class="text-[11px] text-muted-foreground">
            此次修改仅对本次翻译有效，不会修改全局设置。如需永久修改，请到工具栏的
            <button @click="cancelTranslateDialog(); showSettingsModal = true" class="text-primary hover:underline">提示词设置</button>中编辑。
          </p>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="cancelTranslateDialog">取消</UiButton>
          <UiButton @click="confirmTranslate" :disabled="!tempPrompt.trim()">
            <Wand2 class="w-3.5 h-3.5 mr-1.5" />
            开始翻译
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- 批量删除确认模态框 -->
    <UiAlertDialog :open="showBatchDeleteDialog" @update:open="val => showBatchDeleteDialog = val">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>确认批量删除？</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            您即将删除选中的 <strong class="text-foreground">{{ selectedTermIds.length }}</strong> 个词条。此操作不可恢复，是否继续？
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>取消</UiAlertDialogCancel>
          <UiAlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="confirmBatchDelete">确认删除</UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
    
  </div>
</template>
