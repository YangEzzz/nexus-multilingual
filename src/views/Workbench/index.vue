<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'workbench' })

import { Download, Plus, Trash2, Search, CalendarDays, Wand2, Loader2, Upload, Copy, X, ListPlus, Edit3, Save, RotateCcw, ChevronDown, CheckCircle2, Activity, FolderKanban } from 'lucide-vue-next'
import { api } from '@/request'
import { useAuthStore } from '@/store/auth'
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
  created_at?: string;
  updated_at?: string;
  history?: Array<{ time: string; action: string; user: string }>;
}

interface Language {
  code: string;
  name: string;
}

// All possible languages — used as reference for validation, JSON import, etc.
const ALL_LANGUAGES: Language[] = [
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
  { code: 'it', name: '意大利语' },
]

// Only languages configured for this project; drives table columns
const targetLanguages = ref<Language[]>([])

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const projectId = computed(() => route.query.project as string)
// Roles
const isAdmin = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'owner' || authStore.user?.id === 1)
const isProductor = computed(() => authStore.user?.role === 'productor')
const isTranslator = computed(() => authStore.user?.role === 'translator')
const isDeveloper = computed(() => authStore.user?.role === 'developer')

// Project list for the switcher
const projects = ref<any[]>([])
const loadingProjects = ref(false)

async function fetchProjects() {
  loadingProjects.value = true
  try {
    const res = await api.get<any[]>({ url: '/projects' })
    projects.value = res.data ?? []
    
    // If no project in URL, try to auto-load the last one or the first one
    if (!projectId.value && projects.value.length > 0) {
      const lastId = localStorage.getItem('last_project_id')
      const targetId = lastId && projects.value.some(p => String(p.id) === lastId) 
        ? lastId 
        : String(projects.value[0].id)
      
      router.replace({ query: { ...route.query, project: targetId } })
    }
  } catch (e) {
    console.error('Failed to load projects', e)
  } finally {
    loadingProjects.value = false
  }
}

const terms = ref<TermItem[]>([])
const loadingTerms = ref(false)

async function loadProjectLanguages() {
  if (!projectId.value) return
  
  const cachedStr = sessionStorage.getItem(`project_langs_${projectId.value}`)
  if (cachedStr) {
    try {
      const parsed = JSON.parse(cachedStr)
      if (Array.isArray(parsed) && parsed.length > 0) {
        targetLanguages.value = parsed.map((l: any) => ({ code: l.code, name: l.name }))
        return
      }
    } catch { /* ignore */ }
  }

  try {
    const res = await api.get<any>({ url: `/projects/${projectId.value}/languages` })
    if (res.code === 200 && res.data?.length) {
      targetLanguages.value = res.data.map((l: any) => ({ code: l.code, name: l.name }))
    } else {
      targetLanguages.value = ALL_LANGUAGES
    }
  } catch {
    targetLanguages.value = ALL_LANGUAGES
  }
}

async function loadTerms() {
  if (!projectId.value) return
  try {
    const res = await api.get<any>({ url: `/projects/${projectId.value}/terms` })
    if (res.code === 200) {
      terms.value = res.data?.map((t: any) => ({
        ...t,
        translations: t.translations?.reduce((acc: any, tr: any) => {
          acc[tr.language_code] = tr.content
          return acc
        }, {} as Translation) || {}
      })) || []
    }
  } catch (error: any) {
    toast.error('获取词条失败', { description: error.message })
  }
}

const isSavingPrompt = ref(false)
async function saveGlobalPrompt() {
  if (!projectId.value || !isAdmin.value) return
  isSavingPrompt.value = true
  try {
    await api.post({
      url: `/projects/${projectId.value}/update`,
      data: {
        ai_prompt: globalPrompt.value
      }
    })
    toast.success('配置已保存', { description: '全局 AI 提示词已更新。' })
    showSettingsModal.value = false
  } catch (e: any) {
    toast.error('保存失败', { description: e.message })
  } finally {
    isSavingPrompt.value = false
  }
}

async function loadProjectDetails() {
  if (!projectId.value) return
  try {
    const res = await api.get<any>({ url: `/projects/${projectId.value}` })
    if (res.code === 200 && res.data) {
      if (res.data.ai_prompt) {
        globalPrompt.value = res.data.ai_prompt
      }
    }
  } catch (e) {
    console.error('Failed to load project details', e)
  }
}

async function refreshData() {
  if (!projectId.value) return
  loadingTerms.value = true
  await Promise.all([
    loadProjectLanguages(),
    loadTerms(),
    loadProjectDetails()
  ])
  loadingTerms.value = false
}

// Persistence
watch(projectId, (newId) => {
  if (newId) {
    localStorage.setItem('last_project_id', newId)
    refreshData()
  }
})

onMounted(async () => {
  await fetchProjects()
  if (projectId.value) {
    await refreshData()
  }
})


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

const isSavingBatch = ref(false)
async function saveEditMode() {
  const selectedTerms = terms.value.filter(t => selectedTermIds.value.includes(t.id))
  
  if (selectedTerms.length === 0) {
    isGlobalEditing.value = false
    return
  }

  isSavingBatch.value = true
  try {
    const payload = selectedTerms.map(t => ({
      id: t.id,
      module: t.module,
      key: t.key,
      description: t.description,
      status: t.status,
      translations: t.translations
    }))

    await api.post({
      url: `/projects/${projectId.value}/terms/batch-update`,
      data: { terms: payload }
    })
    
    toast.success('批量保存成功', { description: `已成功保存 ${payload.length} 个词条的更改。` })
    isGlobalEditing.value = false
    originalTermsJson.value = ""
    loadTerms() // 刷新最新状态
  } catch (error: any) {
    toast.error('保存失败', { description: error.message || '网络或服务器错误' })
  } finally {
    isSavingBatch.value = false
  }
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

    // Rule: Operations users cannot see drafts
    const matchRole = !isTranslator.value || term.status !== 'draft'

    return matchSearch && matchModule && matchStatus && matchRole
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

const showAddTermModal = ref(false)
const submittingTerm = ref(false)
const newTermForm = ref({
  module: '',
  key: '',
  description: '',
  translations: targetLanguages.value.reduce((acc, lang) => {
    acc[lang.code] = ''
    return acc
  }, {} as Translation)
})

function addNewTerm() {
  newTermForm.value = {
    module: '',
    key: '',
    description: '',
    translations: targetLanguages.value.reduce((acc, lang) => {
      acc[lang.code] = ''
      return acc
    }, {} as Translation)
  }
  showAddTermModal.value = true
}

async function submitNewTerm() {
  if (!newTermForm.value.key) {
    toast.error('必须填写词条 Key')
    return
  }
  submittingTerm.value = true
  try {
    await api.post({
      url: `/projects/${projectId.value}/terms`,
      data: newTermForm.value
    })
    toast.success('词条创建成功')
    showAddTermModal.value = false
    loadTerms()
  } catch (e: any) {
    toast.error('创建失败', { description: e.message })
  } finally {
    submittingTerm.value = false
  }
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

  // 检查是否有参考内容
  const hasReference = Object.values(term.translations).some(v => v && v.trim()) || term.description?.trim()
  if (!hasReference) {
    toast.error('翻译失败', { description: '词条缺少参考内容（描述或已有翻译），AI 无法进行有效翻译。' })
    return
  }
  
  translatingTerms.value.add(term.id)
  try {
    // 格式指令（系统固定，不暴露给用户修改）
    const systemInstruction = `\n\n格式要求：你必须返回一个合法的 JSON 对象。不要返回任何 Markdown 标记符（如 \`\`\`json ），不要返回任何解释。JSON 键名必须严格是以下代号：${targetLanguages.value.map(l => l.code).join(', ')}，对应的值为各语言翻译后的文本。若某语言不知如何翻译，返回空字符串 "".`

    // 构建用户提示词
    let userPrompt: string
    if (customPrompt) {
      userPrompt = customPrompt
    } else {
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

    // Backup for undo
    if (!stagedChangeOriginals.value.has(term.id)) {
      stagedChangeOriginals.value.set(term.id, JSON.stringify(term))
    }

    targetLanguages.value.forEach(lang => {
      if (translatedData[lang.code as keyof typeof translatedData] !== undefined) {
        term.translations[lang.code] = translatedData[lang.code as keyof typeof translatedData] as string
      }
    })

    if (!term.history) term.history = []
    term.history.unshift({
      time: new Date().toLocaleString(),
      action: '使用了 AI 进行了全语言自动翻译 (待确认)',
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

// Track rows that have been modified locally but not yet saved (e.g. by AI)
const stagedChangeOriginals = ref(new Map<string, string>())

async function persistStagedRow(term: TermItem) {
  try {
    await api.post({ 
      url: `/projects/${projectId.value}/terms/${term.id}/update`,
      data: {
        module: term.module,
        key: term.key,
        description: term.description,
        status: term.status,
        translations: term.translations,
      }
    })
    stagedChangeOriginals.value.delete(term.id)
    toast.success('已应用翻译', { description: '内容也已保存到数据库。' })
  } catch (e: any) {
    toast.error('保存失败', { description: e.message })
  }
}

function discardStagedRow(term: TermItem) {
  const original = stagedChangeOriginals.value.get(term.id)
  if (original) {
    const data = JSON.parse(original)
    Object.assign(term, data)
    stagedChangeOriginals.value.delete(term.id)
    toast.info('已撤销 AI 翻译结果')
  }
}


const stagedSelectedIds = computed(() => {
  return selectedTermIds.value.filter(id => stagedChangeOriginals.value.has(id))
})

async function batchPersistStaged() {
  if (stagedSelectedIds.value.length === 0) return
  let successCount = 0
  
  for (const id of stagedSelectedIds.value) {
    const term = terms.value.find(t => t.id === id)
    if (term) {
      try {
        await api.post({ 
          url: `/projects/${projectId.value}/terms/${term.id}/update`,
          data: {
            module: term.module,
            key: term.key,
            description: term.description,
            status: term.status,
            translations: term.translations,
          }
        })
        stagedChangeOriginals.value.delete(term.id)
        successCount++
      } catch (e) {
        console.error(`Failed to persist ${id}`, e)
      }
    }
  }
  toast.success('批量应用成功', { description: `已保存 ${successCount} 个词条的 AI 翻译。` })
}

function batchDiscardStaged() {
  if (stagedSelectedIds.value.length === 0) return
  const count = stagedSelectedIds.value.length
  
  stagedSelectedIds.value.forEach(id => {
    const term = terms.value.find(t => t.id === id)
    if (term) {
      discardStagedRow(term)
    }
  })
  toast.info('已批量撤销', { description: `已恢复 ${count} 个词条。` })
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
      if (term && term.status !== 'published') {
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

const isBatchPublishing = ref(false)

const publishableSelectedIds = computed(() => {
  return selectedTermIds.value.filter(id => {
    const term = terms.value.find(t => Number(t.id) === Number(id))
    return term?.status === 'review'
  })
})

async function batchPublish() {
  const ids = publishableSelectedIds.value.map(id => Number(id))
  
  if (ids.length === 0) {
    toast.info('未找到可发布的词条', { description: '只有处于“待审查”状态的词条才能被发布。' })
    return
  }
  
  if (ids.length < selectedTermIds.value.length) {
    toast.warning('部分选中词条已被跳过', { description: '自动忽略了处于草稿、待翻译或已发布状态的词条。' })
  }
  
  isBatchPublishing.value = true
  
  try {
    await api.post({
      url: `/projects/${projectId.value}/terms/batch-publish`,
      data: { ids }
    })
    
    terms.value.forEach(t => {
      if (ids.includes(Number(t.id))) {
        t.status = 'published'
      }
    })
    
    // 清除选中的可发布词条，如果原本有因为状态不符没发出去的，保留在勾选列表里方便用户查看
    selectedTermIds.value = selectedTermIds.value.filter(id => !publishableSelectedIds.value.includes(id))
    
    toast.success('批量发布成功', { description: `已成功强制发布 ${ids.length} 个审查中的词条。` })
  } catch (e: any) {
    toast.error('发布失败', { description: e.message })
    loadTerms()
  } finally {
    isBatchPublishing.value = false
  }
}

function batchDelete() {
  if (selectedTermIds.value.length === 0) {
    toast.info('请先选择要删除的词条')
    return
  }
  showBatchDeleteDialog.value = true
}

async function confirmBatchDelete() {
  const publishedCount = selectedTermIds.value.filter(id => {
    const term = terms.value.find(t => t.id === id)
    return term?.status === 'published'
  }).length
  
  const ids = selectedTermIds.value
    .filter(id => {
      const term = terms.value.find(t => t.id === id)
      return term?.status !== 'published'
    })
    .map(id => Number(id))

  if (ids.length === 0) {
    toast.error('暂无可删除的词条', { description: '已发布内容禁止批量删除。' })
    showBatchDeleteDialog.value = false
    return
  }
  
  try {
    await api.post({
      url: `/projects/${projectId.value}/terms/batch-delete`,
      data: { ids }
    })
    
    // 等到后端确认删除成功后，再从本地列表剔除并弹出提示
    terms.value = terms.value.filter(t => !ids.includes(Number(t.id)))
    selectedTermIds.value = []
    showBatchDeleteDialog.value = false
    
    let description = `已删除 ${ids.length} 个词条。`
    if (publishedCount > 0) {
      description += ` 其中 ${publishedCount} 个已发布项被自动忽略。`
    }
    toast.success('批量删除成功', { description })
  } catch (e: any) {
    toast.error('删除失败', { description: e.message })
    loadTerms() // 同步最新的真实数据
  }
}

// Removed activeEditKey and startEdit/stopEdit as they are replaced by Global Edit Mode

async function deleteTerm(id: string | number) {
  try {
    await api.post({ url: `/projects/${projectId.value}/terms/${id}/delete` })
    
    // 后端真正删除成功后，更新视图
    terms.value = terms.value.filter(t => Number(t.id) !== Number(id))
    toast.success('删除成功')
  } catch (e: any) {
    toast.error('删除失败', { description: e.message })
    loadTerms()
  }
}

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
const presentDeletingId = ref<string | null>(null)

function openDrawer(term: TermItem) {
  // 深拷贝，防止修改立刻反应到外部表格，直到真正保存
  activeDrawerTerm.value = JSON.parse(JSON.stringify(term))
  isDrawerOpen.value = true
}

const isDrawerDirty = computed(() => {
  if (!activeDrawerTerm.value) return false
  const originalTerm = terms.value.find(t => Number(t.id) === Number(activeDrawerTerm.value!.id))
  return JSON.stringify(originalTerm) !== JSON.stringify(activeDrawerTerm.value)
})

const canPublishInDrawer = computed(() => {
  if (!activeDrawerTerm.value || isTranslator.value) return false
  const originalTerm = terms.value.find(t => Number(t.id) === Number(activeDrawerTerm.value!.id))
  return originalTerm?.status === 'review' && !isDrawerDirty.value
})

const isDrawerTermPublished = computed(() => {
  if (!activeDrawerTerm.value) return false
  const originalTerm = terms.value.find(t => Number(t.id) === Number(activeDrawerTerm.value!.id))
  return originalTerm?.status === 'published'
})

const savingDrawer = ref(false)
const publishingTerm = ref(false)

const showDrawerSaveConfirmModal = ref(false)
function triggerDrawerSave() {
  if (isDrawerTermPublished.value && isDrawerDirty.value) {
    showDrawerSaveConfirmModal.value = true
  } else {
    saveDrawer()
  }
}
function confirmDrawerSave() {
  showDrawerSaveConfirmModal.value = false
  if (activeDrawerTerm.value) {
    activeDrawerTerm.value.status = 'review'
  }
  saveDrawer()
}

async function saveDrawer() {
  if (!activeDrawerTerm.value) return
  savingDrawer.value = true
  try {
    await api.post({
      url: `/projects/${projectId.value}/terms/${activeDrawerTerm.value.id}/update`,
      data: {
        module: activeDrawerTerm.value.module,
        key: activeDrawerTerm.value.key,
        description: activeDrawerTerm.value.description,
        status: activeDrawerTerm.value.status,
        translations: activeDrawerTerm.value.translations,
      }
    })
    toast.success('更新成功', { description: '词条详情已保存。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
    loadTerms()
  } catch (e: any) {
    toast.error('保存失败', { description: e.message })
  } finally {
    savingDrawer.value = false
  }
}

const showDrawerPublishConfirmModal = ref(false)
function triggerDrawerPublish() {
  showDrawerPublishConfirmModal.value = true
}
function confirmDrawerPublish() {
  showDrawerPublishConfirmModal.value = false
  publishTerm()
}

async function publishTerm() {
  if (!activeDrawerTerm.value) return
  publishingTerm.value = true
  try {
    await api.post({ url: `/projects/${projectId.value}/terms/${activeDrawerTerm.value.id}/publish` })
    toast.success('已发布', { description: '词条状态已更新为已发布。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
    loadTerms()
  } catch (e: any) {
    toast.error('发布失败', { description: e.message })
  } finally {
    publishingTerm.value = false
  }
}

const translatingDrawer = ref(false)
async function translateDrawerTerm() {
  if (!activeDrawerTerm.value || !activeDrawerTerm.value.key) {
    toast.warning('缺少关键信息', { description: '请先填写 Key 再翻译' })
    return
  }

  // 检测是否有参考内容（正文或描述）
  const hasReference = Object.values(activeDrawerTerm.value.translations).some(v => v && v.trim()) || activeDrawerTerm.value.description?.trim()
  if (!hasReference) {
    toast.warning('无法翻译', { description: '该词条目前只有 Key，缺乏任何参考内容。请至少填写一个语种的正文（如：中文）或上下文描述，AI 才能开始工作。' })
    return
  }

  translatingDrawer.value = true
  
  try {
    const prompt = `你是一个专业的本地化翻译助手。
将下面的词条翻译为纯JSON格式，Key为语言简码，Value为翻译结果：
目标语言代码：
${targetLanguages.value.map(l => `- ${l.code}: ${l.name}`).join('\n')}

待翻译词条：
Key: ${activeDrawerTerm.value.key}
描述: ${activeDrawerTerm.value.description || '无'}
现有参考:
${JSON.stringify(activeDrawerTerm.value.translations)}
`
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    const text = response.text || ''
    
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('解析 JSON 失败')
    
    const translatedData = JSON.parse(jsonMatch[0])
    targetLanguages.value.forEach(lang => {
      if (translatedData[lang.code as keyof typeof translatedData] !== undefined) {
        activeDrawerTerm.value!.translations[lang.code] = translatedData[lang.code as keyof typeof translatedData] as string
      }
    })

    if (activeDrawerTerm.value!.status === 'published') {
      activeDrawerTerm.value!.status = 'review'
    } else if (activeDrawerTerm.value!.status === 'draft') {
      activeDrawerTerm.value!.status = 'pending'
    }

    toast.success('AI 翻译完成 (未保存)', { description: '请复核后点击保存。' })
  } catch (error) {
    console.error('Drawer AI translation error', error)
    toast.error('AI 翻译失败')
  } finally {
    translatingDrawer.value = false
  }
}

const showBatchPublishConfirmModal = ref(false)
function triggerBatchPublish() {
  showBatchPublishConfirmModal.value = true
}
function confirmBatchPublish() {
  showBatchPublishConfirmModal.value = false
  batchPublish()
}

function closeDrawer() {
  isDrawerOpen.value = false
  activeDrawerTerm.value = null
}

const excelFileInput = ref<HTMLInputElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)

function triggerExcelImport() {
  excelFileInput.value?.click()
}

function triggerJsonImport() {
  jsonFileInput.value?.click()
}

const importingJson = ref(false)

async function handleJsonImport(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const validCodes = ALL_LANGUAGES.map(l => l.code)
  const projectCodes = targetLanguages.value.map(l => l.code)
  importingJson.value = true

  let totalCreated = 0
  let totalUpdated = 0
  const errors: string[] = []

  for (const file of Array.from(files)) {
    const langCode = file.name.replace(/\.json$/i, '').toLowerCase()

    // Tier 1: not a known language code at all — filename is wrong
    if (!langCode || !validCodes.includes(langCode)) {
      errors.push(`「${file.name}」文件名无法识别为语言代码，跳过`)
      continue
    }

    // Tier 2: valid code but not configured in this project — prompt user to add it
    if (!projectCodes.includes(langCode)) {
      const langName = ALL_LANGUAGES.find(l => l.code === langCode)?.name ?? langCode
      errors.push(`「${file.name}」[${langName}] 未在本项目中配置，请先到项目设置中添加该语言，跳过`)
      continue
    }

    try {
      const text = await file.text()
      const data: Record<string, string> = JSON.parse(text)
      if (typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`「${file.name}」格式错误，需为 { key: value } 对象`)
        continue
      }
      const res = await api.post<any>({
        url: `/projects/${projectId.value}/terms/import-json`,
        data: { language_code: langCode, data }
      })
      if (res.code === 200) {
        totalCreated += res.data.created
        totalUpdated += res.data.updated
      } else {
        errors.push(`「${file.name}」：${res.message}`)
      }
    } catch (e: any) {
      errors.push(`「${file.name}」：${e.message}`)
    }
  }

  if (errors.length > 0) {
    toast.warning(`导入完成（含 ${errors.length} 个错误）`, {
      description: errors.join('\n')
    })
  } else {
    toast.success(`全部导入成功（${files.length} 个文件）`, {
      description: `新建词条：${totalCreated} 个，更新翻译：${totalUpdated} 条`
    })
  }

  loadTerms()
  importingJson.value = false
  if (target) target.value = ''
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
  const hasSelected = Array.isArray(selectedTermIds.value) && selectedTermIds.value.length > 0
  const itemsToExport = hasSelected
    ? terms.value.filter(term => selectedTermIds.value.includes(term.id))
    : filteredTerms.value

  if (!itemsToExport || itemsToExport.length === 0) {
    toast.warning('剪贴板提取失败', { description: '抱歉，当前页面或选中列表中没有词条供导出。' })
    return
  }

  // 构建嵌套结构
  const exportObject: any = {}
  itemsToExport.forEach(term => {
    const val = term.translations[langCode] || ''
    if (term.module) {
      if (!exportObject[term.module]) exportObject[term.module] = {}
      exportObject[term.module][term.key] = val
    } else {
      exportObject[term.key] = val
    }
  })

  try {
    const jsonStr = JSON.stringify(exportObject, null, 2)
    
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
    toast.warning('导出提醒', { description: '请至少选择一种语言导出！' })
    return
  }

  const langsToExport = targetLanguages.value.filter(lang => selectedExportLangs.value.includes(lang.code))
  
  langsToExport.forEach(lang => {
    const hasSelected = Array.isArray(selectedTermIds.value) && selectedTermIds.value.length > 0
    const itemsToExport = hasSelected
      ? terms.value.filter(term => selectedTermIds.value.includes(term.id))
      : filteredTerms.value

    if (!itemsToExport || itemsToExport.length === 0) return

    // 构建嵌套结构
    const exportObject: any = {}
    itemsToExport.forEach(term => {
      const val = term.translations[lang.code] || ''
      if (term.module) {
        if (!exportObject[term.module]) exportObject[term.module] = {}
        exportObject[term.module][term.key] = val
      } else {
        exportObject[term.key] = val
      }
    })

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lang.code}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
  
  toast.success('导出成功', { description: `已触发 ${langsToExport.length} 个本地化文件的下载。` })
  closeExportModal()
}

function exportToExcel() {
  const hasSelected = Array.isArray(selectedTermIds.value) && selectedTermIds.value.length > 0
  const itemsToExport = hasSelected
    ? terms.value.filter(term => selectedTermIds.value.includes(term.id))
    : filteredTerms.value

  if (!itemsToExport || itemsToExport.length === 0) {
    toast.warning('导出提醒', { description: '没有可以导出的词条。' })
    return
  }

  const exportRows = itemsToExport.map(term => {
    const row: any = {
      'Module': term.module || '',
      'Key': term.key || '',
      'Description': term.description || '',
      'Status': statusOptions.find(o => o.value === term.status)?.label || term.status,
    }
    // Add all language translations as columns
    targetLanguages.value.forEach(lang => {
      row[lang.name] = term.translations[lang.code] || ''
    })
    return row
  })

  try {
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Translations')
    XLSX.writeFile(wb, `translations_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('导出成功', { description: `已导出 ${itemsToExport.length} 条数据到 Excel。` })
  } catch (err) {
    console.error('Export Excel Error:', err)
    toast.error('导出失败')
  }
}

</script>

<template>
  <div class="h-full flex flex-col p-6 space-y-4 bg-gray-50 dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">词条工作台</h1>
          <p class="text-[10px] text-gray-400 mt-0.5">多语言词条翻译与管理系统</p>
        </div>

        <div class="hidden sm:block h-8 w-px bg-gray-200 dark:bg-zinc-800 mx-1" />

        <!-- Project Switcher -->
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton variant="ghost" class="h-10 flex items-center px-3 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
              <FolderKanban class="w-4 h-4 mr-2 text-primary" />
              <span class="font-medium text-sm">
                {{ projects.find(p => String(p.id) === projectId)?.name || '加载中...' }}
              </span>
              <ChevronDown class="ml-2 w-4 h-4 text-gray-400" />
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="start" class="w-56">
            <UiDropdownMenuLabel class="text-xs text-gray-400">切换当前工作项目</UiDropdownMenuLabel>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem 
              v-for="p in projects" :key="p.id" 
              @click="router.push({ query: { ...route.query, project: p.id } })"
              class="flex items-center justify-between"
              :class="String(p.id) === projectId && 'bg-primary/10 text-primary font-medium'"
            >
              {{ p.name }}
              <CheckCircle2 v-if="String(p.id) === projectId" class="w-3 h-3" />
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
      </div>
      <div class="flex gap-2">
        <input 
          type="file" 
          ref="excelFileInput" 
          accept=".xlsx, .xls, .csv" 
          class="hidden" 
          @change="handleExcelImport" 
        />
        <input 
          type="file" 
          ref="jsonFileInput" 
          accept=".json" 
          multiple
          class="hidden" 
          @change="handleJsonImport" 
        />
        <!-- Dropdown for Data Operations: Ops/Product cannot see -->
        <UiDropdownMenu v-if="!isTranslator && !isProductor">
          <UiDropdownMenuTrigger as-child>
            <UiButton variant="outline" class="gap-2">
              <Upload class="w-4 h-4" />
              数据导入/导出
              <ChevronDown class="w-3.5 h-3.5 opacity-50" />
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end" class="w-48">
            <UiDropdownMenuItem @click="triggerJsonImport" :disabled="importingJson || isGlobalEditing">
               <Loader2 v-if="importingJson" class="w-4 h-4 mr-2 animate-spin" />
               <Upload v-else class="w-4 h-4 mr-2 text-muted-foreground" />
               {{ importingJson ? '导入中...' : '导入多语言 JSON' }}
            </UiDropdownMenuItem>
            <UiDropdownMenuItem @click="triggerExcelImport" :disabled="isGlobalEditing">
               <Upload class="w-4 h-4 mr-2 text-muted-foreground" />
               导入 Excel
            </UiDropdownMenuItem>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem @click="openExportModal" class="text-indigo-600 focus:text-indigo-700">
               <Download class="w-4 h-4 mr-2" />
               导出多语言 JSON
            </UiDropdownMenuItem>
            <UiDropdownMenuItem @click="exportToExcel" class="text-emerald-600 focus:text-emerald-700">
               <Download class="w-4 h-4 mr-2" />
               导出为 Excel
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>

        <UiButton 
          variant="outline"
          @click="showBatchAddModal = true"
          :disabled="isGlobalEditing"
        >
          <ListPlus class="w-4 h-4 mr-2" />
          快捷批量创建
        </UiButton>
        
        <UiButton 
          v-if="!isTranslator"
          variant="outline"
          class="text-primary border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 dark:border-primary/30 dark:text-primary-foreground"
          @click="router.push({ path: '/project-logs', query: { project: projectId } })"
        >
          <Activity class="w-4 h-4 mr-2" />
          操作日志
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
            :disabled="isSavingBatch"
            class="shadow-sm"
          >
            <Loader2 v-if="isSavingBatch" class="w-4 h-4 mr-2 animate-spin" />
            <Save v-else class="w-4 h-4 mr-2" />
            保存全部
          </UiButton>
        </div>

        <UiButton 
          v-if="isAdmin || isDeveloper"
          variant="default"
          @click="addNewTerm"
          :disabled="isGlobalEditing"
        >
          <Plus class="w-4 h-4 mr-2" />
          新建词条
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

        <template v-if="isAdmin">
          <UiSeparator orientation="vertical" class="h-6 mx-1" />
          <UiTooltipProvider>
            <UiTooltip>
              <UiTooltipTrigger as-child>
                <UiButton variant="outline" size="icon" class="h-9 w-9 shrink-0" @click="showSettingsModal = true">
                  <Wand2 class="w-4 h-4 text-primary" />
                </UiButton>
              </UiTooltipTrigger>
              <UiTooltipContent>AI 提示词配置</UiTooltipContent>
            </UiTooltip>
          </UiTooltipProvider>
        </template>
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
            <!-- Split Batch Translate Button: Developer cannot self-translate -->
            <div class="inline-flex items-center rounded-md shadow-sm" v-if="!isDeveloper">
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
            
            <template v-if="stagedSelectedIds.length > 0">
              <UiButton 
                variant="outline" 
                size="sm" 
                @click="batchPersistStaged" 
                class="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
              >
                <CheckCircle2 class="w-3.5 h-3.5 mr-1.5" />
                采纳 AI 建议 ({{ stagedSelectedIds.length }})
              </UiButton>
              <UiButton 
                variant="outline" 
                size="sm" 
                @click="batchDiscardStaged" 
                class="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
                舍弃 AI 建议
              </UiButton>
              <UiSeparator class="h-5 mx-1" orientation="vertical" />
            </template>

            <UiButton 
              variant="outline" 
              size="sm" 
              @click="triggerBatchPublish" 
              :disabled="isBatchPublishing || publishableSelectedIds.length === 0"
              class="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isBatchPublishing" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <CheckCircle2 v-else class="w-3.5 h-3.5 mr-1.5" />
              批量发布 {{ publishableSelectedIds.length > 0 ? `(${publishableSelectedIds.length})` : '' }}
            </UiButton>
            
            <UiButton variant="destructive" size="sm" @click="batchDelete">
              <Trash2 class="w-3.5 h-3.5 mr-1.5" />
              批量删除
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 词条表格 -->
    <div class="flex-1 relative overflow-hidden rounded-lg border border-gray-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-950">
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
            <UiTableHead class="w-24 text-center">操作</UiTableHead>
            <UiTableHead class="min-w-[150px]">Key & Info</UiTableHead>
            <UiTableHead class="w-28 text-center">状态</UiTableHead>
            <UiTableHead v-for="lang in targetLanguages" :key="lang.code" class="min-w-[200px]">
              {{ lang.name }} <span class="text-[10px] opacity-50 font-mono">({{ lang.code }})</span>
            </UiTableHead>
            <UiTableHead class="w-36 text-muted-foreground">创建时间</UiTableHead>
            <UiTableHead class="w-36 text-muted-foreground">更新时间</UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          <UiTableRow 
            v-for="term in filteredTerms" 
            :key="term.id"
            class="group hover:bg-gray-50/50 dark:hover:bg-zinc-900/50 transition-colors border-b border-gray-100 dark:border-zinc-800"
            :class="{ 
              'bg-primary/[0.03] dark:bg-primary/[0.05]': selectedTermIds.includes(term.id),
              'bg-amber-50/30 dark:bg-amber-920/10 shadow-[inset_2px_0_0_0_#f59e0b]': stagedChangeOriginals.has(term.id)
            }"
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
            <UiTableCell class="align-top text-center p-2 w-24">
              <UiTooltipProvider>
                <div class="flex items-center justify-center gap-1.5 pt-1">
                  <!-- Staged Actions (Wait for review) -->
                  <template v-if="stagedChangeOriginals.has(term.id)">
                    <UiTooltip>
                      <UiTooltipTrigger as-child>
                        <button 
                          @click="persistStagedRow(term)"
                          class="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-md transition-all"
                        >
                          <CheckCircle2 class="w-3.5 h-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">接受并保存</UiTooltipContent>
                    </UiTooltip>
                    
                    <UiTooltip>
                      <UiTooltipTrigger as-child>
                        <button 
                          @click="discardStagedRow(term)"
                          class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all"
                        >
                          <RotateCcw class="w-3.5 h-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">撤销翻译</UiTooltipContent>
                    </UiTooltip>
                  </template>

                  <!-- Normal Actions -->
                  <template v-else>
                    <!-- Edit/Detail Button -->
                    <UiTooltip>
                      <UiTooltipTrigger as-child>
                        <button 
                          @click="openDrawer(term)"
                          class="p-1.5 hover:text-primary hover:bg-primary/10 rounded-md transition-all text-muted-foreground"
                        >
                          <Edit3 class="w-3.5 h-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">配置详情</UiTooltipContent>
                    </UiTooltip>

                    <!-- Translate Button: Developer cannot self-translate -->
                    <UiTooltip v-if="term.status !== 'published' && !isDeveloper">
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
                      <UiTooltipContent side="top">AI 翻译</UiTooltipContent>
                    </UiTooltip>
                    <UiTooltip v-else>
                      <UiTooltipTrigger as-child>
                        <button disabled class="p-1.5 text-gray-300 dark:text-gray-600 rounded-md cursor-not-allowed">
                          <Wand2 class="w-3.5 h-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">请通过配置详情进行更新</UiTooltipContent>
                    </UiTooltip>
                    
                    <UiAlertDialog v-if="term.status !== 'published' && !isTranslator && !isProductor" @update:open="val => presentDeletingId = val ? term.id : null">
                      <UiTooltip :open="presentDeletingId === term.id ? false : undefined">
                        <UiTooltipTrigger as-child v-if="isAdmin || isDeveloper">
                          <UiAlertDialogTrigger as-child>
                            <button class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all">
                              <Trash2 class="w-3.5 h-3.5" />
                            </button>
                          </UiAlertDialogTrigger>
                        </UiTooltipTrigger>
                        <UiTooltipTrigger as-child v-else>
                          <button disabled class="p-1.5 text-gray-200 cursor-not-allowed">
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top">{{ (isAdmin || isDeveloper) ? '删除词条' : '无权删除' }}</UiTooltipContent>
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
                    <UiTooltip v-else>
                      <UiTooltipTrigger as-child>
                        <button disabled class="p-1.5 text-gray-200 dark:text-gray-700 rounded-md cursor-not-allowed">
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">{{ term.status === 'published' ? '不可删除线上已发布项' : '无权限操作' }}</UiTooltipContent>
                    </UiTooltip>
                  </template>
                </div>
              </UiTooltipProvider>
            </UiTableCell>

            <!-- 词条基础信息列 (Optimized Layout) -->
            <UiTableCell class="align-top p-3 min-w-[150px]" :class="{ 'bg-primary/[0.02]': (isGlobalEditing && selectedTermIds.includes(term.id) && term.status !== 'published') || stagedChangeOriginals.has(term.id) }">
              <div class="flex flex-col gap-1 min-w-0">
                <!-- Row 1: Module & Key & Sidebar Toggle -->
                <div class="flex items-center gap-1.5 min-w-0 h-6">
                  <template v-if="(isGlobalEditing && selectedTermIds.includes(term.id) && term.status !== 'published') || stagedChangeOriginals.has(term.id)">
                    <div class="flex items-center gap-1 flex-1 min-w-0">
                      <UiInput 
                        v-model="term.module" 
                        :disabled="isTranslator || isProductor"
                        class="h-6 w-16 text-[10px] font-mono text-primary bg-background border-primary/20 shrink-0 px-1"
                        placeholder="模块"
                      />
                      <UiInput 
                        v-model="term.key"
                        :disabled="isTranslator || isProductor"
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
                      <span 
                        class="font-bold text-[13px] text-gray-900 dark:text-gray-100 truncate flex-1" 
                        :title="term.key"
                      >
                        {{ term.key || 'Untitled_Key' }}
                      </span>
                    </div>
                  </template>
                </div>

                <!-- Row 2: Subtle Description -->
                <div class="min-w-0 h-5">
                  <template v-if="(isGlobalEditing && selectedTermIds.includes(term.id) && term.status !== 'published') || stagedChangeOriginals.has(term.id)">
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
            <UiTableCell class="align-top p-3 text-center w-32" :class="{ 'bg-primary/[0.02]': (isGlobalEditing && selectedTermIds.includes(term.id) && term.status !== 'published') || stagedChangeOriginals.has(term.id) }">
              <div class="flex justify-center pt-1">
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
              </div>
            </UiTableCell>

            <!-- 多语言翻译列 -->
            <UiTableCell v-for="lang in targetLanguages" :key="lang.code" class="align-top p-2 group/cell" :class="{ 'bg-primary/[0.01]': (isGlobalEditing && selectedTermIds.includes(term.id) && term.status !== 'published') || stagedChangeOriginals.has(term.id) }">
              <div class="min-h-[44px] relative">
                <template v-if="(isGlobalEditing && selectedTermIds.includes(term.id) && term.status !== 'published') || stagedChangeOriginals.has(term.id)">
                  <UiTextarea 
                    v-model="term.translations[lang.code]"
                    :disabled="isDeveloper"
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

            <!-- 创建时间 & 更新时间 -->
            <UiTableCell class="align-top p-3 w-36 text-xs text-muted-foreground whitespace-nowrap">
              {{ term.created_at ? new Date(term.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' }}
            </UiTableCell>
            <UiTableCell class="align-top p-3 w-36 text-xs text-muted-foreground whitespace-nowrap">
              {{ term.updated_at ? new Date(term.updated_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' }}
            </UiTableCell>

          </UiTableRow>

          <!-- Empty State Row -->
          <UiTableRow v-if="filteredTerms.length === 0 && !loadingTerms">
            <UiTableCell :colspan="targetLanguages.length + 6" class="h-[400px] text-center p-0 border-none hover:bg-transparent">
              <div class="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <div class="size-16 rounded-full bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
                  <Search class="size-8 opacity-20" />
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium">暂无词条数据</p>
                  <p class="text-xs opacity-60">尝试更改搜索词或新建一个词条</p>
                </div>
                <UiButton variant="outline" size="sm" class="mt-2" @click="showAddTermModal = true">
                  <Plus class="size-3.5 mr-1.5" />
                  新建词条
                </UiButton>
              </div>
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>

      <!-- 绝对定位的 Empty / Loading 覆盖层，始终在视口水平居中，无视表格向右滚动 -->
      <div v-if="loadingTerms" class="absolute inset-0 top-[40px] flex items-center justify-center bg-white/70 dark:bg-zinc-950/70 backdrop-blur-[1px] z-20">
        <div class="flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 rounded-lg bg-white shadow-sm border border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
          <Loader2 class="size-8 animate-spin text-primary" />
          <p class="text-sm font-medium">正在加载词条数据...</p>
        </div>
      </div>


    </div>

    <!-- 快捷批量创建模态框 -->
    <UiDialog :open="showBatchAddModal" @update:open="val => showBatchAddModal = val">
      <UiDialogContent class="sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle>快捷批量创建词条</UiDialogTitle>
          <UiDialogDescription>
            每行输入一个你要翻译的文本内容。如果包含中文字符，将自动填入“中文”列；否则将填入“Key”列。
          </UiDialogDescription>
        </UiDialogHeader>
        
        <div class="py-4">
          <UiLabel class="mb-2 block text-gray-500 text-xs">粘贴你的清单，一行一条：</UiLabel>
          <UiTextarea 
            v-model="batchAddText"
            placeholder="例如：
确认删除吗？
Please confirm your action"
            class="min-ih-[260px] font-mono text-sm p-4 leading-relaxed bg-gray-50/50 dark:bg-zinc-900/50"
          />
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="showBatchAddModal = false">取消</UiButton>
          <UiButton @click="confirmBatchAdd" :disabled="!batchAddText.trim()">确认并创建</UiButton>
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
              <UiSheetTitle class="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 w-full min-w-0 pr-4">
                <UiInput 
                  v-model="activeDrawerTerm.module" 
                  class="h-8 w-24 text-sm font-mono text-primary bg-transparent border-transparent hover:border-gray-200 focus-visible:ring-1 focus-visible:border-gray-200 shrink-0 px-1 disabled:opacity-80 disabled:bg-transparent disabled:border-transparent disabled:cursor-not-allowed"
                  placeholder="模块"
                  :disabled="isDrawerTermPublished || isTranslator || isProductor"
                />
                <span class="text-gray-400 font-bold shrink-0">.</span>
                <UiInput 
                  v-model="activeDrawerTerm.key"
                  @update:model-value="handleKeyUpdate(activeDrawerTerm)"
                  class="h-8 flex-1 text-sm font-bold bg-transparent border-transparent hover:border-gray-200 focus-visible:ring-1 focus-visible:border-gray-200 px-1 disabled:opacity-100 disabled:bg-transparent disabled:border-transparent disabled:cursor-not-allowed"
                  placeholder="Key (必填)"
                  :disabled="isDrawerTermPublished || isTranslator || isProductor"
                />
              </UiSheetTitle>
              <div 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium shadow-sm shrink-0"
                :class="[
                  activeDrawerTerm?.status === 'draft' ? 'bg-slate-50 text-slate-600 border-slate-200' : 
                  activeDrawerTerm?.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  activeDrawerTerm?.status === 'review' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                ]"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="getStatusColor(activeDrawerTerm?.status || '')"></span>
                {{ statusOptions.find(o => o.value === activeDrawerTerm?.status)?.label || activeDrawerTerm?.status }}
              </div>
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
          </div>

          <hr class="border-gray-100 dark:border-zinc-800" />

          <!-- Section: All Translations form -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                多语言翻译
                <span class="text-xs font-normal text-gray-500">{{ targetLanguages.length }} 个语种</span>
              </div>
              <UiButton v-if="!isDeveloper" variant="outline" size="sm" class="h-7 text-xs px-2 cursor-pointer border-primary/20 hover:border-primary/50 text-primary/80" :disabled="translatingDrawer" @click="translateDrawerTerm">
                <Loader2 v-if="translatingDrawer" class="w-3 h-3 mr-1.5 animate-spin" />
                <Wand2 v-else class="w-3 h-3 mr-1.5" />
                AI 翻译当前
              </UiButton>
            </h3>
            <div class="grid grid-cols-1 gap-4">
              <div v-for="lang in targetLanguages" :key="lang.code" class="group">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex justify-between">
                  <span>{{ lang.name }} <span class="uppercase text-gray-400 translate-y-px inline-block ml-1">({{ lang.code }})</span></span>
                </label>
                <UiTextarea 
                  v-model="activeDrawerTerm.translations[lang.code]"
                  :disabled="isDeveloper"
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

          <!-- Drawer Footer -->
          <UiSheetFooter class="p-6 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
            <div class="flex justify-between items-center w-full gap-3">
              <UiButton variant="outline" @click="closeDrawer" class="flex-1">取消</UiButton>
              <div class="flex gap-2 flex-1">
                <UiButton 
                  class="flex-1"
                  :disabled="!isDrawerDirty || savingDrawer" 
                  @click="triggerDrawerSave"
                >
                  <Loader2 v-if="savingDrawer" class="w-4 h-4 mr-2 animate-spin" />
                  <Save v-else class="w-4 h-4 mr-2" />
                  保存修改
                </UiButton>
                <!-- Publish Button in Drawer -->
                <UiButton 
                  v-if="canPublishInDrawer"
                  variant="default"
                  class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  :disabled="savingDrawer || isDrawerDirty"
                  @click="triggerDrawerPublish"
                >
                  <CheckCircle2 class="w-4 h-4 mr-2" />
                  直接发布
                </UiButton>
              </div>
            </div>
          </UiSheetFooter>
        </div>
      </UiSheetContent>
    </UiSheet>

    <!-- AlertDialogs for Safety -->
    <UiAlertDialog :open="showBatchPublishConfirmModal" @update:open="val => showBatchPublishConfirmModal = val">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>确认批量发布？</UiAlertDialogTitle>
          <UiAlertDialogDescription>您即将发布选中的词条，线上内容将被更新，请确认无误。</UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>取消</UiAlertDialogCancel>
          <UiAlertDialogAction class="bg-indigo-600 hover:bg-indigo-700 text-white" @click="confirmBatchPublish">确认发布</UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>

    <UiAlertDialog :open="showDrawerSaveConfirmModal" @update:open="val => showDrawerSaveConfirmModal = val">
      <UiAlertDialogContent class="z-[100]">
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>确认覆盖线上发布内容？</UiAlertDialogTitle>
          <UiAlertDialogDescription>该词条已被发布过。修改保存后，其状态将退回为【待审阅（Review）】，原有的线上版本将被新内容覆盖。确认继续吗？</UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>取消</UiAlertDialogCancel>
          <UiAlertDialogAction class="bg-primary text-primary-foreground hover:bg-primary/90" @click="confirmDrawerSave">确认覆盖</UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>

    <UiAlertDialog :open="showDrawerPublishConfirmModal" @update:open="val => showDrawerPublishConfirmModal = val">
      <UiAlertDialogContent class="z-[100]">
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>确认直接发布该词条？</UiAlertDialogTitle>
          <UiAlertDialogDescription>确认为最终译文并发布该词条吗？</UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>取消</UiAlertDialogCancel>
          <UiAlertDialogAction class="bg-indigo-600 hover:bg-indigo-700 text-white" @click="confirmDrawerPublish">确认发布</UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>

    <!-- 导出模态框 -->
    <UiDialog :open="showExportModal" @update:open="val => showExportModal = val">
      <UiDialogContent class="sm:max-w-md z-[100]">
        <UiDialogHeader>
          <UiDialogTitle>导出多语言 JSON</UiDialogTitle>
          <UiDialogDescription>
            请选择要导出的语言简码（将为每个选中的语言生成一个 JSON 文件）。
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="py-4 space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium">选择目标语种</h4>
            <div class="flex items-center gap-2">
              <button @click="selectAllExportLangs" class="text-[10px] text-primary hover:underline">全选</button>
              <span class="text-[10px] text-muted-foreground opacity-30">|</span>
              <button @click="deselectAllExportLangs" class="text-[10px] text-muted-foreground hover:underline">清空</button>
            </div>
          </div>
          <UiScrollArea class="h-[300px] border rounded-md p-2 bg-gray-50/50 dark:bg-zinc-900/50">
            <div class="grid grid-cols-1 gap-1">
              <div 
                v-for="lang in targetLanguages" 
                :key="lang.code"
                @click="toggleExportLang(lang.code)"
                class="flex items-center gap-3 p-2 rounded-md hover:bg-white dark:hover:bg-zinc-800 cursor-pointer transition-colors border border-transparent hover:border-border"
                :class="selectedExportLangs.includes(lang.code) ? 'bg-white dark:bg-zinc-800 border-border shadow-sm' : ''"
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
          <UiButton @click="confirmExport" class="bg-green-600 hover:bg-green-700 text-white">
            确认导出 ({{ selectedExportLangs.length }})
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
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
          <UiButton variant="outline" @click="showSettingsModal = false">取消</UiButton>
          <UiButton :disabled="isSavingPrompt" @click="saveGlobalPrompt">
            <Loader2 v-if="isSavingPrompt" class="mr-2 h-4 w-4 animate-spin" />
            保存全局配置
          </UiButton>
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
            :disabled="!isAdmin"
            class="min-h-[180px] font-mono text-sm leading-relaxed p-3 bg-gray-50/50 dark:bg-zinc-900/50 disabled:opacity-80"
            placeholder="输入或修改提示词..."
          />
          <p class="text-[11px] text-muted-foreground">
            此次修改仅对本次翻译有效，不会修改全局设置。<template v-if="isAdmin">如需永久修改，请到工具栏的
            <button @click="cancelTranslateDialog(); showSettingsModal = true" class="text-primary hover:underline">提示词设置</button>中编辑。</template>
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
    
    <!-- 新建词条模态框 -->
    <UiDialog v-model:open="showAddTermModal">
      <UiDialogContent class="sm:max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>新建词条</UiDialogTitle>
          <UiDialogDescription>
            创建一个新的多语言词条。
          </UiDialogDescription>
        </UiDialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <UiLabel>模块 (Module)</UiLabel>
            <UiInput v-model="newTermForm.module" placeholder="例如: common, auth" />
          </div>
          <div class="grid gap-2">
            <UiLabel>键名 (Key) *</UiLabel>
            <UiInput v-model="newTermForm.key" placeholder="例如: confirm, username_placeholder" class="font-mono" />
          </div>
          <div class="grid gap-2">
            <UiLabel>描述说明</UiLabel>
            <UiTextarea v-model="newTermForm.description" placeholder="用途说明或上下文..." rows="3" />
          </div>
        </div>
        <UiDialogFooter>
          <UiButton variant="outline" @click="showAddTermModal = false">取消</UiButton>
          <UiButton :disabled="submittingTerm" @click="submitNewTerm">
            <Loader2 v-if="submittingTerm" class="size-4 mr-2 animate-spin" />
            新建
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
    
  </div>
</template>
