<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'workbench' })

import { Download, Plus, Trash2, Search, CalendarDays, Wand2, Loader2, Upload, Copy, X, ListPlus, Edit3, Save, RotateCcw, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, Activity, FolderKanban, Wrench } from 'lucide-vue-next'
import { api } from '@/request'
import { useAuthStore } from '@/store/auth'
import { ai } from '@/lib/gemini'
import { fetchAvailableLanguages } from '@/lib/available-languages'
import { diffPlaceholders, extractPlaceholders } from '@/lib/placeholders'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/constants/pagination'
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

interface BatchCreateRow {
  clientId: string
  key: string
  module: string
  description: string
  sourceText: string
}

interface Language {
  code: string;
  name: string;
  is_source?: boolean;
}

// Only languages configured for this project; drives table columns
const targetLanguages = ref<Language[]>([])
const availableLanguages = ref<Language[]>([])

const sourceLanguageCode = computed(() => {
  return targetLanguages.value.find(lang => lang.is_source)?.code
    || targetLanguages.value.find(lang => lang.code === 'cn')?.code
    || targetLanguages.value.find(lang => lang.code === 'zh')?.code
    || targetLanguages.value.find(lang => lang.code === 'zh-CN')?.code
    || targetLanguages.value.find(lang => lang.code === 'en')?.code
    || targetLanguages.value[0]?.code
})

function getPlaceholderSource(term: TermItem) {
  const sourceCode = sourceLanguageCode.value
  if (sourceCode && term.translations[sourceCode]?.trim()) {
    return term.translations[sourceCode]
  }

  const firstFilledTranslation = Object.values(term.translations).find(value => value?.trim())
  if (firstFilledTranslation) return firstFilledTranslation

  return term.description || ''
}

function getTranslationPlaceholderDiff(term: TermItem, langCode: string) {
  const source = getPlaceholderSource(term)
  const target = term.translations[langCode] || ''

  if (!extractPlaceholders(source).length) {
    return { missing: [], extra: [] }
  }

  return diffPlaceholders(source, target)
}

function hasTranslationPlaceholderMismatch(term: TermItem, langCode: string) {
  const diff = getTranslationPlaceholderDiff(term, langCode)
  return diff.missing.length > 0 || diff.extra.length > 0
}

function getTermPlaceholderIssues(term: TermItem) {
  return targetLanguages.value
    .map(lang => ({
      lang,
      diff: getTranslationPlaceholderDiff(term, lang.code),
    }))
    .filter(item => item.diff.missing.length > 0 || item.diff.extra.length > 0)
}

function formatPlaceholderIssues(term: TermItem) {
  return getTermPlaceholderIssues(term)
    .map(({ lang, diff }) => {
      const parts = []
      if (diff.missing.length) parts.push(`缺少 ${diff.missing.join(', ')}`)
      if (diff.extra.length) parts.push(`多出 ${diff.extra.join(', ')}`)
      return `${lang.name}: ${parts.join('，')}`
    })
    .join('；')
}

function placeholderInstructionForTerm(term: TermItem) {
  const placeholders = extractPlaceholders(getPlaceholderSource(term))
  if (!placeholders.length) return ''

  return `\n\n占位符保护要求：本词条包含代码运行时变量 ${placeholders.join(', ')}。所有目标语言译文必须原样保留这些占位符；不要翻译、删除、重命名、增减、改变大小写或改变花括号。可以根据语序移动位置，但占位符文本必须完全一致。`
}

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
        targetLanguages.value = parsed.map((l: any) => ({ code: l.code, name: l.name, is_source: l.is_source }))
        return
      }
    } catch { /* ignore */ }
  }

  try {
    const res = await api.get<any>({ url: `/projects/${projectId.value}/languages` })
    if (res.code === 200 && res.data?.length) {
      targetLanguages.value = res.data.map((l: any) => ({ code: l.code, name: l.name, is_source: l.is_source }))
    } else {
      targetLanguages.value = availableLanguages.value
    }
  } catch {
    targetLanguages.value = availableLanguages.value
  }
}

async function loadAvailableLanguages() {
  try {
    availableLanguages.value = (await fetchAvailableLanguages()).map(lang => ({ code: lang.code, name: lang.name }))
  }
  catch (error) {
    console.error('Failed to load available languages', error)
    availableLanguages.value = []
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
  await loadAvailableLanguages()
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
  if (selectedCount.value === 0) {
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
  const selectedTerms = selectedTermsForBulk.value

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
const chineseSearchQuery = ref('')
const englishSearchQuery = ref('')
const selectedModule = ref('all')
const selectedStatus = ref('all')
const currentPage = ref(1)
const pageSize = ref<number>(DEFAULT_PAGE_SIZE)

const currentProject = computed(() => projects.value.find(project => String(project.id) === projectId.value))
const visibleTerms = computed(() => terms.value.filter(term => !isTranslator.value || term.status !== 'draft'))
const publishedTermCount = computed(() => visibleTerms.value.filter(term => term.status === 'published').length)
const pendingTermCount = computed(() => visibleTerms.value.filter(term => term.status === 'pending').length)
const readyTermCount = computed(() => visibleTerms.value.filter(isReadyForReview).length)
const publishedRate = computed(() => visibleTerms.value.length
  ? Math.round((publishedTermCount.value / visibleTerms.value.length) * 100)
  : 0)
const hasActiveFilters = computed(() => Boolean(
  searchQuery.value.trim()
  || chineseSearchQuery.value.trim()
  || englishSearchQuery.value.trim()
  || selectedModule.value !== 'all'
  || selectedStatus.value !== 'all',
))

watch(currentProject, (project) => {
  document.title = project?.name
    ? `词条工作台：${project.name} — Nexus Multilingual`
    : '词条工作台 — Nexus Multilingual'
}, { immediate: true })

function clearAllFilters() {
  searchQuery.value = ''
  chineseSearchQuery.value = ''
  englishSearchQuery.value = ''
  selectedModule.value = 'all'
  selectedStatus.value = 'all'
}

async function clearSearchField(field: 'key' | 'zh' | 'en') {
  const fields = {
    key: { state: searchQuery, id: 'term-search' },
    zh: { state: chineseSearchQuery, id: 'term-search-zh' },
    en: { state: englishSearchQuery, id: 'term-search-en' },
  }
  fields[field].state.value = ''
  await nextTick()
  document.getElementById(fields[field].id)?.focus()
}

const modules = computed(() => {
  const mods = new Set(terms.value.map(t => t.module))
  return Array.from(mods)
})

function isReadyForReview(term: TermItem) {
  return term.status !== 'review'
    && term.status !== 'published'
    && Boolean(term.key?.trim())
    && getMissingTranslationLanguages(term).length === 0
}

const filteredTerms = computed(() => {
  return terms.value.filter(term => {
    const keyword = searchQuery.value.trim().toLowerCase()
    const chineseKeyword = chineseSearchQuery.value.trim().toLowerCase()
    const englishKeyword = englishSearchQuery.value.trim().toLowerCase()

    // Search match
    const matchSearch = !keyword
      || term.key.toLowerCase().includes(keyword)
      || term.module.toLowerCase().includes(keyword)
    const chineseText = [
      term.translations.cn,
      term.translations.zh,
      term.translations['zh-CN'],
      term.translations.cht,
    ].filter(Boolean).join('\n').toLowerCase()
    const matchChinese = !chineseKeyword || chineseText.includes(chineseKeyword)
    const matchEnglish = !englishKeyword || (term.translations.en || '').toLowerCase().includes(englishKeyword)

    // Module match
    const matchModule = selectedModule.value === 'all' ||
                        (selectedModule.value === '__none__' && term.module === '') ||
                        term.module === selectedModule.value

    // Status match
    const matchStatus = selectedStatus.value === 'all'
      || (selectedStatus.value === 'ready_review' ? isReadyForReview(term) : term.status === selectedStatus.value)

    // Rule: Operations users cannot see drafts
    const matchRole = !isTranslator.value || term.status !== 'draft'

    return matchSearch && matchChinese && matchEnglish && matchModule && matchStatus && matchRole
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredTerms.value.length / pageSize.value)))
const paginatedTerms = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTerms.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => filteredTerms.value.length === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredTerms.value.length))

watch([searchQuery, chineseSearchQuery, englishSearchQuery, selectedModule, selectedStatus], () => {
  currentPage.value = 1
  clearSelectedTerms()
})

watch(pageSize, () => {
  currentPage.value = 1
})

watch(totalPages, (nextTotalPages) => {
  if (currentPage.value > nextTotalPages) {
    currentPage.value = nextTotalPages
  }
})

function goToFirstPage() {
  currentPage.value = 1
}

function goToPreviousPage() {
  currentPage.value = Math.max(1, currentPage.value - 1)
}

function goToNextPage() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1)
}

function goToLastPage() {
  currentPage.value = totalPages.value
}

const statusOptions = [
  { value: 'draft', label: '草稿', color: 'bg-gray-500' },
  { value: 'pending', label: '待翻译', color: 'bg-yellow-500' },
  { value: 'ready_review', label: '待校对', color: 'bg-sky-500' },
  { value: 'review', label: '待发布', color: 'bg-blue-500' },
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
    const systemInstruction = `\n\n格式要求：你必须返回一个合法的 JSON 对象。不要返回任何 Markdown 标记符（如 \`\`\`json ），不要返回任何解释。JSON 键名必须严格是以下代号：${targetLanguages.value.map(l => l.code).join(', ')}，对应的值为各语言翻译后的文本。若某语言不知如何翻译，返回空字符串 ""。${placeholderInstructionForTerm(term)}`

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

    const placeholderIssues = getTermPlaceholderIssues(term)
    if (placeholderIssues.length > 0) {
      toast.warning('AI 翻译完成，但占位符需要复核', {
        description: placeholderIssues.map(item => item.lang.name).join('、'),
      })
    }

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

const selectedTermIds = ref<string[]>([])

function isTermSelected(term: TermItem) {
  return selectedTermIds.value.some(id => String(id) === String(term.id))
}

const selectedTermsForBulk = computed(() => {
  return terms.value.filter(term => isTermSelected(term))
})

const selectedCount = computed(() => selectedTermsForBulk.value.length)

const stagedSelectedTerms = computed(() => {
  return selectedTermsForBulk.value.filter(term => stagedChangeOriginals.value.has(term.id))
})

const stagedSelectedIds = computed(() => {
  return stagedSelectedTerms.value.map(term => String(term.id))
})

async function batchPersistStaged() {
  if (stagedSelectedTerms.value.length === 0) return
  let successCount = 0

  for (const term of stagedSelectedTerms.value) {
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
      console.error(`Failed to persist ${term.id}`, e)
    }
  }
  toast.success('批量应用成功', { description: `已保存 ${successCount} 个词条的 AI 翻译。` })
}

function batchDiscardStaged() {
  if (stagedSelectedTerms.value.length === 0) return
  const count = stagedSelectedTerms.value.length

  stagedSelectedTerms.value.forEach(term => {
    discardStagedRow(term)
  })
  toast.info('已批量撤销', { description: `已恢复 ${count} 个词条。` })
}

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
  return paginatedTerms.value.length > 0 && paginatedTerms.value.every(term => isTermSelected(term))
})

const isIndeterminate = computed(() => {
  const selectedOnPage = paginatedTerms.value.filter(term => isTermSelected(term)).length
  return selectedOnPage > 0 && selectedOnPage < paginatedTerms.value.length
})

const checkboxAllState = computed(() => {
  if (isAllSelected.value) return true
  if (isIndeterminate.value) return 'indeterminate'
  return false
})

const isAllFilteredSelected = computed(() => {
  return filteredTerms.value.length > 0 && filteredTerms.value.every(term => isTermSelected(term))
})

const canSelectAllFiltered = computed(() => {
  return paginatedTerms.value.length > 0
    && filteredTerms.value.length > paginatedTerms.value.length
    && isAllSelected.value
    && !isAllFilteredSelected.value
})

function toggleSelectTerm(id: string, checked: any) {
  const isChecked = checked === true || checked === 'true'
  const normalizedId = String(id)
  if (isChecked) {
    if (!selectedTermIds.value.includes(normalizedId)) {
      selectedTermIds.value = [...selectedTermIds.value, normalizedId]
    }
  } else {
    selectedTermIds.value = selectedTermIds.value.filter(i => i !== normalizedId)
  }
}

function handleSelectAll(checked: any) {
  const isChecked = checked === true || checked === 'true'
  const pageIds = paginatedTerms.value.map(t => String(t.id))
  if (isChecked) {
    selectedTermIds.value = Array.from(new Set([...selectedTermIds.value, ...pageIds]))
  } else {
    selectedTermIds.value = selectedTermIds.value.filter(id => !pageIds.includes(id))
  }
}

function selectAllFilteredTerms() {
  selectedTermIds.value = filteredTerms.value.map(term => String(term.id))
  toast.success('已选择全部筛选结果', {
    description: `共 ${selectedCount.value} 条词条。`,
  })
}

function clearSelectedTerms() {
  selectedTermIds.value = []
}

async function batchTranslate(customPrompt?: string) {
  const termsToTranslate = selectedTermsForBulk.value
  if (termsToTranslate.length === 0) return
  isBatchTranslating.value = true
  let successCount = 0
  let failCount = 0

  // 并发请求数量控制 (控制在3个以内避免超出 AI API 频率限制)
  const batchSize = 3
  for (let i = 0; i < termsToTranslate.length; i += batchSize) {
    const batchList = termsToTranslate.slice(i, i + batchSize)
    const promises = batchList.map(async (term) => {
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
  if (selectedCount.value === 0) return
  // 预填全局提示词（保留变量占位符，因为批量时每个词条居中注入）
  tempPrompt.value = globalPrompt.value
  pendingBatchTranslate.value = true
}

const isBatchPublishing = ref(false)
const isBatchApprovingReview = ref(false)

const publishableSelectedTerms = computed(() => {
  return selectedTermsForBulk.value.filter(term => term.status === 'review')
})

const publishableSelectedIds = computed(() => {
  return publishableSelectedTerms.value.map(term => String(term.id))
})

const reviewableSelectedTerms = computed(() => {
  return selectedTermsForBulk.value.filter(term => term.status !== 'review' && term.status !== 'published')
})

const reviewableSelectedIds = computed(() => {
  return reviewableSelectedTerms.value.map(term => String(term.id))
})

async function batchApproveReview() {
  if (selectedCount.value === 0) return
  const selectedTerms = reviewableSelectedTerms.value

  if (selectedTerms.length === 0) {
    toast.info('未找到可校对的词条', { description: '待发布和已发布词条会被自动跳过。' })
    return
  }

  const invalidMessages: string[] = []
  selectedTerms.forEach(term => {
    if (!term.key?.trim()) {
      invalidMessages.push(`${term.key || term.id}: 缺少 Key`)
      return
    }

    const missingLangs = getMissingTranslationLanguages(term)
    if (missingLangs.length > 0) {
      invalidMessages.push(`${term.key}: 缺少 ${missingLangs.map(lang => lang.name).join('、')}`)
      return
    }

    if (getTermPlaceholderIssues(term).length > 0) {
      invalidMessages.push(`${term.key}: ${formatPlaceholderIssues(term)}`)
    }
  })

  if (invalidMessages.length > 0) {
    toast.error('无法批量校对通过', {
      description: invalidMessages.slice(0, 3).join('；'),
    })
    return
  }

  isBatchApprovingReview.value = true
  try {
    const payload = selectedTerms.map(term => ({
      id: term.id,
      module: term.module,
      key: term.key,
      description: term.description,
      status: 'review',
      translations: term.translations,
    }))

    await api.post({
      url: `/projects/${projectId.value}/terms/batch-update`,
      data: { terms: payload },
    })

    selectedTerms.forEach(term => {
      term.status = 'review'
    })

    toast.success('批量校对通过', { description: `已将 ${selectedTerms.length} 个词条设为待发布。` })
  } catch (e: any) {
    toast.error('批量校对失败', { description: e.message })
    loadTerms()
  } finally {
    isBatchApprovingReview.value = false
  }
}

async function batchPublish() {
  const ids = publishableSelectedTerms.value.map(term => Number(term.id))
  const publishedIds = publishableSelectedTerms.value.map(term => String(term.id))

  if (ids.length === 0) {
    toast.info('未找到可发布的词条', { description: '只有处于“待发布”状态的词条才能被发布。' })
    return
  }

  if (ids.length < selectedCount.value) {
    toast.warning('部分选中词条已被跳过', { description: '自动忽略了处于草稿、待翻译或已发布状态的词条。只有“待发布”词条会被发布。' })
  }

  const invalidTerms = terms.value.filter(term => ids.includes(Number(term.id)) && getTermPlaceholderIssues(term).length > 0)
  if (invalidTerms.length > 0) {
    toast.error('占位符不一致，无法批量发布', {
      description: invalidTerms.slice(0, 3).map(term => `${term.key || term.id}: ${formatPlaceholderIssues(term)}`).join('；'),
    })
    return
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
    selectedTermIds.value = selectedTermIds.value.filter(id => !publishedIds.includes(id))

    toast.success('批量发布成功', { description: `已成功发布 ${ids.length} 个待发布词条。` })
  } catch (e: any) {
    toast.error('发布失败', { description: e.message })
    loadTerms()
  } finally {
    isBatchPublishing.value = false
  }
}

function batchDelete() {
  if (selectedCount.value === 0) {
    toast.info('请先选择要删除的词条')
    return
  }
  showBatchDeleteDialog.value = true
}

async function confirmBatchDelete() {
  const publishedCount = selectedTermsForBulk.value.filter(term => term.status === 'published').length

  const ids = selectedTermsForBulk.value
    .filter(term => term.status !== 'published')
    .map(term => Number(term.id))

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
const batchAddStep = ref<'input' | 'preview'>('input')
const batchSourceLangCode = ref('')
const batchDefaultModule = ref('')
const batchCreateRows = ref<BatchCreateRow[]>([])
const batchAddError = ref('')
const isBatchCreatingTerms = ref(false)
const recentlyCreatedTermIds = ref<string[]>([])
const BATCH_CREATE_LIMIT = 500

function resetBatchAdd() {
  batchAddText.value = ''
  batchAddStep.value = 'input'
  batchDefaultModule.value = ''
  batchCreateRows.value = []
  batchAddError.value = ''
  batchSourceLangCode.value = sourceLanguageCode.value || targetLanguages.value[0]?.code || ''
}

function openBatchAddDialog() {
  resetBatchAdd()
  showBatchAddModal.value = true
}

function handleBatchAddOpenChange(open: boolean) {
  if (isBatchCreatingTerms.value)
    return
  showBatchAddModal.value = open
  if (!open)
    resetBatchAdd()
}

function parseBatchCreateLine(line: string, index: number): BatchCreateRow {
  const text = line.trim()
  const tabIndex = text.indexOf('\t')
  const pipeIndex = text.indexOf('|')
  const separatorIndex = tabIndex >= 0 ? tabIndex : pipeIndex

  return {
    clientId: `row-${Date.now()}-${index + 1}`,
    key: separatorIndex >= 0 ? text.slice(0, separatorIndex).trim() : '',
    module: batchDefaultModule.value.trim(),
    description: '',
    sourceText: separatorIndex >= 0 ? text.slice(separatorIndex + 1).trim() : text,
  }
}

function confirmBatchAdd() {
  batchAddError.value = ''
  if (!batchSourceLangCode.value) {
    batchAddError.value = '当前项目没有可用语言，请先配置项目语言。'
    return
  }

  const lines = batchAddText.value.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) {
    batchAddError.value = '请至少输入一条内容。'
    return
  }
  if (lines.length > BATCH_CREATE_LIMIT) {
    batchAddError.value = `单次最多创建 ${BATCH_CREATE_LIMIT} 个词条，当前共 ${lines.length} 条。`
    return
  }

  batchCreateRows.value = lines.map(parseBatchCreateLine)
  batchAddStep.value = 'preview'
}

const batchRowErrors = computed(() => {
  const errors = new Map<string, string>()
  const batchIdentityCounts = new Map<string, number>()
  const existingIdentities = new Set(
    terms.value.map(term => `${term.module.trim()}\u0000${term.key.trim()}`),
  )

  for (const row of batchCreateRows.value) {
    const identity = `${row.module.trim()}\u0000${row.key.trim()}`
    batchIdentityCounts.set(identity, (batchIdentityCounts.get(identity) || 0) + 1)
  }

  for (const row of batchCreateRows.value) {
    const key = row.key.trim()
    const module = row.module.trim()
    const identity = `${module}\u0000${key}`
    if (!key)
      errors.set(row.clientId, '请填写 Key')
    else if (key.length > 255)
      errors.set(row.clientId, 'Key 不能超过 255 个字符')
    else if (module.length > 100)
      errors.set(row.clientId, '模块不能超过 100 个字符')
    else if (!row.sourceText.trim())
      errors.set(row.clientId, '请填写原文')
    else if ((batchIdentityCounts.get(identity) || 0) > 1)
      errors.set(row.clientId, '本批次中存在重复的模块和 Key')
    else if (existingIdentities.has(identity))
      errors.set(row.clientId, '当前项目已存在相同模块和 Key')
  }

  return errors
})

const validBatchCreateCount = computed(() => batchCreateRows.value.length - batchRowErrors.value.size)

function removeBatchCreateRow(clientId: string) {
  batchCreateRows.value = batchCreateRows.value.filter(row => row.clientId !== clientId)
  if (batchCreateRows.value.length === 0)
    batchAddStep.value = 'input'
}

async function submitBatchCreate() {
  if (!projectId.value || batchCreateRows.value.length === 0 || batchRowErrors.value.size > 0)
    return

  isBatchCreatingTerms.value = true
  batchAddError.value = ''
  try {
    const res = await api.post<any>({
      url: `/projects/${projectId.value}/terms/batch-create`,
      data: {
        terms: batchCreateRows.value.map(row => ({
          clientId: row.clientId,
          key: row.key.trim(),
          module: row.module.trim(),
          description: row.description.trim(),
          translations: {
            [batchSourceLangCode.value]: row.sourceText.trim(),
          },
        })),
      },
    })

    const createdIds = (res.data?.terms || []).map((item: any) => String(item.term?.id)).filter(Boolean)
    recentlyCreatedTermIds.value = createdIds
    currentPage.value = 1
    await loadTerms()
    showBatchAddModal.value = false
    resetBatchAdd()
    toast.success('批量创建成功', {
      description: `已成功创建 ${res.data?.createdCount ?? createdIds.length} 个词条。`,
    })
    window.setTimeout(() => {
      recentlyCreatedTermIds.value = []
    }, 5000)
  }
  catch (error: any) {
    batchAddError.value = error.message || '批量创建失败，请检查后重试。'
  }
  finally {
    isBatchCreatingTerms.value = false
  }
}

// Focus logic removed as part of Global Edit Mode cleanup

const showExportModal = ref(false)
const selectedExportLangs = ref<string[]>([])
const isExportingJson = ref(false)
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

const canApproveReviewInDrawer = computed(() => {
  if (!activeDrawerTerm.value || isTranslator.value) return false
  return activeDrawerTerm.value.status !== 'review' && activeDrawerTerm.value.status !== 'published'
})

const isDrawerTermPublished = computed(() => {
  if (!activeDrawerTerm.value) return false
  const originalTerm = terms.value.find(t => Number(t.id) === Number(activeDrawerTerm.value!.id))
  return originalTerm?.status === 'published'
})

const savingDrawer = ref(false)
const publishingTerm = ref(false)
const approvingReview = ref(false)

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

function getMissingTranslationLanguages(term: TermItem) {
  return targetLanguages.value.filter(lang => !term.translations[lang.code]?.trim())
}

async function approveDrawerReview() {
  if (!activeDrawerTerm.value) return

  if (!activeDrawerTerm.value.key?.trim()) {
    toast.error('无法校对通过', { description: '请先填写词条 Key。' })
    return
  }

  const missingLangs = getMissingTranslationLanguages(activeDrawerTerm.value)
  if (missingLangs.length > 0) {
    toast.error('无法校对通过', {
      description: `请先补全译文：${missingLangs.map(lang => lang.name).join('、')}`,
    })
    return
  }

  const placeholderIssues = getTermPlaceholderIssues(activeDrawerTerm.value)
  if (placeholderIssues.length > 0) {
    toast.error('占位符不一致，无法校对通过', {
      description: formatPlaceholderIssues(activeDrawerTerm.value),
    })
    return
  }

  approvingReview.value = true
  try {
    activeDrawerTerm.value.status = 'review'
    await api.post({
      url: `/projects/${projectId.value}/terms/${activeDrawerTerm.value.id}/update`,
      data: {
        module: activeDrawerTerm.value.module,
        key: activeDrawerTerm.value.key,
        description: activeDrawerTerm.value.description,
        status: activeDrawerTerm.value.status,
        translations: activeDrawerTerm.value.translations,
      },
    })
    toast.success('校对通过', { description: '词条已进入待发布状态。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
    loadTerms()
  } catch (e: any) {
    toast.error('校对失败', { description: e.message })
  } finally {
    approvingReview.value = false
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
  const placeholderIssues = getTermPlaceholderIssues(activeDrawerTerm.value)
  if (placeholderIssues.length > 0) {
    toast.error('占位符不一致，无法发布', {
      description: formatPlaceholderIssues(activeDrawerTerm.value),
    })
    return
  }

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
${placeholderInstructionForTerm(activeDrawerTerm.value)}
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

    const placeholderIssues = getTermPlaceholderIssues(activeDrawerTerm.value)
    if (placeholderIssues.length > 0) {
      toast.warning('AI 翻译完成，但占位符需要复核', {
        description: placeholderIssues.map(item => item.lang.name).join('、'),
      })
    }

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
const importingExcel = ref(false)
const excelImportStage = ref('')

interface JsonImportItem {
  module: string
  key: string
  content: string
}

function triggerExcelImport() {
  if (importingExcel.value)
    return
  excelFileInput.value?.click()
}

function triggerJsonImport() {
  jsonFileInput.value?.click()
}

const importingJson = ref(false)
const showObjectImportModal = ref(false)
const objectImportText = ref('')
const objectImportLangCode = ref('')
const importingObjectJson = ref(false)

function isPrimitiveImportValue(value: unknown) {
  return ['string', 'number', 'boolean'].includes(typeof value)
}

function flattenObjectImport(data: Record<string, unknown>) {
  const items: JsonImportItem[] = []

  function visit(value: unknown, path: string[], module = '') {
    if (isPrimitiveImportValue(value)) {
      const key = path.join('.')
      if (key) {
        items.push({ module, key, content: String(value) })
      }
      return
    }

    if (!value || Array.isArray(value) || typeof value !== 'object') return

    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      visit(childValue, [...path, childKey], module)
    })
  }

  Object.entries(data).forEach(([topLevelKey, value]) => {
    if (isPrimitiveImportValue(value)) {
      items.push({ module: '', key: topLevelKey, content: String(value) })
      return
    }

    if (value && !Array.isArray(value) && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
        visit(childValue, [childKey], topLevelKey)
      })
    }
  })

  return items
}

function normalizeJsonImport(data: unknown, mode: 'flat' | 'object') {
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error(mode === 'object' ? '格式错误，需为对象 JSON' : '格式错误，需为 { key: value } 对象')
  }

  const objectData = data as Record<string, unknown>
  if (mode === 'object') {
    return flattenObjectImport(objectData)
  }

  return Object.entries(objectData).map(([key, value]) => {
    if (!isPrimitiveImportValue(value)) {
      throw new Error('扁平模式只支持 { key: value }，对象结构请使用“导入对象 JSON”')
    }
    return { module: '', key, content: String(value) }
  })
}

function parsePastedObject(input: string) {
  try {
    return JSON.parse(input)
  } catch {
    return Function(`"use strict"; return (${input});`)()
  }
}

function openObjectImportModal() {
  objectImportLangCode.value = sourceLanguageCode.value || targetLanguages.value[0]?.code || ''
  objectImportText.value = ''
  showObjectImportModal.value = true
}

async function submitObjectImport() {
  if (!objectImportLangCode.value) {
    toast.warning('请选择导入语言')
    return
  }
  if (!objectImportText.value.trim()) {
    toast.warning('请先粘贴对象 JSON')
    return
  }

  importingObjectJson.value = true
  try {
    const parsed = parsePastedObject(objectImportText.value)
    const items = normalizeJsonImport(parsed, 'object')
    if (items.length === 0) {
      toast.warning('未找到可导入的文本内容')
      return
    }

    const res = await api.post<any>({
      url: `/projects/${projectId.value}/terms/import-json`,
      data: {
        language_code: objectImportLangCode.value,
        items,
      },
    })

    if (res.code === 200) {
      toast.success('对象 JSON 导入成功', {
        description: `新建词条：${res.data.created} 个，更新翻译：${res.data.updated} 条`,
      })
      showObjectImportModal.value = false
      objectImportText.value = ''
      loadTerms()
    } else {
      toast.error('导入失败', { description: res.message })
    }
  } catch (e: any) {
    toast.error('导入失败', { description: e.message })
  } finally {
    importingObjectJson.value = false
  }
}

async function handleJsonImport(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const validCodes = availableLanguages.value.map(lang => lang.code)
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
      const langName = availableLanguages.value.find(lang => lang.code === langCode)?.name ?? langCode
      errors.push(`「${file.name}」[${langName}] 未在本项目中配置，请先到项目设置中添加该语言，跳过`)
      continue
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const items = normalizeJsonImport(data, 'flat')
      const res = await api.post<any>({
        url: `/projects/${projectId.value}/terms/import-json`,
        data: { language_code: langCode, items }
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
  if (!file)
    return

  importingExcel.value = true
  excelImportStage.value = '正在读取文件'
  const importToastId = toast.loading('正在导入 Excel', {
    description: `正在读取「${file.name}」，请勿关闭页面。`,
    duration: Infinity,
  })

  try {
    // Let Vue paint the loading state before XLSX performs synchronous parsing.
    await nextTick()
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))

    const data = await file.arrayBuffer()
    excelImportStage.value = '正在解析并校验'
    toast.loading('正在导入 Excel', {
      id: importToastId,
      description: `正在解析并校验「${file.name}」。`,
      duration: Infinity,
    })
    await nextTick()
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))

    const workbook = XLSX.read(data)
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('无法读取 Excel 的工作表。')
    }
    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      throw new Error('找不到该工作表。')
    }

    // Parse as 2D array
    const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (json.length < 2) {
      throw new Error('未检测到有效数据或语言标识头。')
    }

    const header = json[0] || []
    const keyHeader = typeof header[0] === 'string' ? header[0].trim().toLowerCase() : ''
    if (keyHeader !== 'key') {
      throw new Error('第一列的表头必须是 key。')
    }

    // Filter only columns where the header matches an existing language code
    const langIdxMap = new Map<number, string>()
    header.forEach((col: string, idx: number) => {
      if (idx > 0 && col && typeof col === 'string') {
        const code = col.trim().toLowerCase()
        const matchedLanguage = targetLanguages.value.find(lang => lang.code.toLowerCase() === code)
        if (matchedLanguage) {
          langIdxMap.set(idx, matchedLanguage.code)
        }
      }
    })

    if (langIdxMap.size === 0) {
      throw new Error('第一行无法识别任何支持的语言代码（如 cn、en）。')
    }

    const rowsToImport: Array<{
      clientId: string
      key: string
      module: string
      description: string
      translations: Translation
    }> = []
    const validationErrors: string[] = []
    const importedKeys = new Set<string>()
    const existingKeys = new Set(
      terms.value
        .filter(term => !term.module.trim())
        .map(term => term.key.trim()),
    )

    // Loop through remaining rows and validate before sending anything to the server
    for (let i = 1; i < json.length; i++) {
      const row = json[i]
      if (!row || row.length === 0)
        continue

      const rowNumber = i + 1
      const key = row[0] === undefined || row[0] === null ? '' : String(row[0]).trim()
      const hasContent = Array.from(langIdxMap.keys()).some(idx => row[idx] && String(row[idx]).trim() !== '')
      if (!key && !hasContent)
        continue
      if (!key) {
        validationErrors.push(`第 ${rowNumber} 行：key 不能为空`)
        continue
      }
      if (Array.from(key).length > 255) {
        validationErrors.push(`第 ${rowNumber} 行：key 不能超过 255 个字符`)
        continue
      }
      if (!hasContent) {
        validationErrors.push(`第 ${rowNumber} 行：至少填写一种语言内容`)
        continue
      }
      if (importedKeys.has(key)) {
        validationErrors.push(`第 ${rowNumber} 行：key「${key}」在表格中重复`)
        continue
      }
      if (existingKeys.has(key)) {
        validationErrors.push(`第 ${rowNumber} 行：当前项目已存在 key「${key}」`)
        continue
      }

      const translations = targetLanguages.value.reduce((acc, lang) => {
        acc[lang.code] = ''
        return acc
      }, {} as Translation)

      langIdxMap.forEach((langCode, idx) => {
        if (row[idx] !== undefined && row[idx] !== null) {
          translations[langCode] = String(row[idx]).trim()
        }
      })

      importedKeys.add(key)
      rowsToImport.push({
        clientId: `excel-row-${rowNumber}`,
        module: '',
        key,
        description: '',
        translations,
      })
    }

    if (validationErrors.length > 0) {
      const visibleErrors = validationErrors.slice(0, 5)
      const remainingCount = validationErrors.length - visibleErrors.length
      throw new Error(`${visibleErrors.join('；')}${remainingCount > 0 ? `；另有 ${remainingCount} 个错误` : ''}`)
    }

    if (rowsToImport.length === 0) {
      throw new Error('未检测到可导入的数据。')
    }

    if (rowsToImport.length > BATCH_CREATE_LIMIT) {
      throw new Error(`单次最多导入 ${BATCH_CREATE_LIMIT} 条，当前共 ${rowsToImport.length} 条。`)
    }

    excelImportStage.value = `正在导入 ${rowsToImport.length} 条词条`
    toast.loading('正在导入 Excel', {
      id: importToastId,
      description: `文件校验通过，正在创建 ${rowsToImport.length} 个词条。`,
      duration: Infinity,
    })
    const res = await api.post<any>({
      url: `/projects/${projectId.value}/terms/batch-create`,
      data: { terms: rowsToImport },
    })
    if (res.code !== 200) {
      throw new Error(res.message || '服务器未能完成 Excel 导入')
    }

    excelImportStage.value = '正在刷新词条列表'
    await loadTerms()
    toast.success('导入成功', {
      id: importToastId,
      description: `已从 Excel 创建 ${res.data?.createdCount ?? rowsToImport.length} 个词条。`,
    })
  }
  catch (error: any) {
    console.error(error)
    toast.error('导入失败', {
      id: importToastId,
      description: error.message || 'Excel 解析出现异常。',
    })
  }
  finally {
    importingExcel.value = false
    excelImportStage.value = ''
    // Reset file input so same file can be imported again if needed
    if (target)
      target.value = ''
  }
}

// Side drawer functions already defined above

// Default exclusions: 'tr' (土耳其语), 'bn' (孟加拉语), 'pl' (波兰语), 'it' (意大利语)
const defaultExcludedLangs = ['tr', 'bn', 'pl', 'it']

async function copyLangJson(langCode: string, langName: string) {
  const hasSelected = selectedCount.value > 0
  const itemsToExport = hasSelected
    ? selectedTermsForBulk.value
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

function createJsonExportObject(langCode: string, itemsToExport: TermItem[]) {
  const exportObject: Record<string, string | Record<string, string>> = {}

  itemsToExport.forEach((term) => {
    const value = term.translations[langCode] || ''
    if (term.module) {
      const moduleValue = exportObject[term.module]
      const moduleTranslations = typeof moduleValue === 'object' ? moduleValue : {}
      moduleTranslations[term.key] = value
      exportObject[term.module] = moduleTranslations
    } else {
      exportObject[term.key] = value
    }
  })

  return exportObject
}

async function createZipArchive(files: Record<string, Uint8Array>) {
  const { zip } = await import('fflate')
  return new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(data)
    })
  })
}

function getJsonArchiveName() {
  const projectName = String(currentProject.value?.name || 'translations')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[.\s]+$/g, '')
    .slice(0, 80) || 'translations'
  const date = new Date().toISOString().slice(0, 10)
  return `${projectName}_locales_${date}.zip`
}

async function confirmExport() {
  if (selectedExportLangs.value.length === 0) {
    toast.warning('导出提醒', { description: '请至少选择一种语言导出！' })
    return
  }

  const langsToExport = targetLanguages.value.filter(lang => selectedExportLangs.value.includes(lang.code))
  const hasSelected = selectedCount.value > 0
  const itemsToExport = hasSelected
    ? selectedTermsForBulk.value
    : filteredTerms.value

  if (!itemsToExport.length) {
    toast.warning('导出提醒', { description: '当前筛选结果或选中列表中没有可导出的词条。' })
    return
  }

  isExportingJson.value = true
  try {
    const { strToU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = {}
    langsToExport.forEach((lang) => {
      const exportObject = createJsonExportObject(lang.code, itemsToExport)
      files[`${lang.code}.json`] = strToU8(JSON.stringify(exportObject, null, 2))
    })

    const archive = await createZipArchive(files)
    const blob = new Blob([archive], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getJsonArchiveName()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast.success('导出成功', {
      description: `已将 ${langsToExport.length} 个语言 JSON 打包为一个 ZIP 文件。`,
    })
    closeExportModal()
  } catch (error: any) {
    console.error('Export JSON ZIP Error:', error)
    toast.error('导出失败', { description: error?.message || 'ZIP 文件生成失败，请重试。' })
  } finally {
    isExportingJson.value = false
  }
}

function exportToExcel() {
  const hasSelected = selectedCount.value > 0
  const itemsToExport = hasSelected
    ? selectedTermsForBulk.value
    : filteredTerms.value

  if (!itemsToExport || itemsToExport.length === 0) {
    toast.warning('导出提醒', { description: '没有可以导出的词条。' })
    return
  }

  const exportRows = itemsToExport.map((term) => {
    const row: any = {
      key: term.key || '',
      Module: term.module || '',
      Description: term.description || '',
      Status: statusOptions.find(o => o.value === term.status)?.label || term.status,
    }
    // Add all language translations as columns
    targetLanguages.value.forEach((lang) => {
      row[lang.code] = term.translations[lang.code] || ''
    })
    return row
  })

  try {
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Translations')
    XLSX.writeFile(wb, `translations_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('导出成功', { description: `已导出 ${itemsToExport.length} 条数据到 Excel。` })
  }
  catch (err) {
    console.error('Export Excel Error:', err)
    toast.error('导出失败')
  }
}

</script>

<template>
  <div class="flex min-h-[calc(100svh-3rem)] flex-col gap-4 p-4 md:min-h-svh lg:p-6">
    <header class="shrink-0 space-y-4">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div class="shrink-0">
            <h1 class="text-2xl font-semibold tracking-tight text-foreground">词条工作台</h1>
            <p class="mt-1 text-sm text-muted-foreground">管理当前项目的词条、译文与发布流程</p>
          </div>

          <div class="hidden h-10 w-px bg-border sm:block" />

          <!-- Project Switcher -->
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton variant="outline" class="h-10 max-w-[300px] justify-start rounded-xl bg-background px-3">
              <span class="mr-2 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <FolderKanban class="size-3.5 text-primary" />
              </span>
              <span class="min-w-0 text-left">
                <span class="block text-[10px] leading-none text-muted-foreground">当前项目</span>
                <span class="mt-1 block truncate text-sm font-medium leading-none">{{ currentProject?.name || '加载中...' }}</span>
              </span>
              <ChevronDown class="ml-auto size-4 shrink-0 text-muted-foreground" />
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

          <div class="flex min-w-0 items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs">
            <span class="font-medium text-foreground">{{ targetLanguages.find(lang => lang.code === sourceLanguageCode)?.name || '源语言' }}</span>
            <span class="text-primary">→</span>
            <span class="truncate text-muted-foreground">{{ Math.max(targetLanguages.length - 1, 0) }} 个目标语种</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 xl:justify-end">
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
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton
              variant="outline"
              class="w-[7.5rem] justify-center gap-2 rounded-xl"
              :disabled="importingExcel"
              :aria-label="importingExcel ? excelImportStage : '打开工作台工具箱'"
            >
              <Loader2 v-if="importingExcel" class="size-4 animate-spin" />
              <Wrench v-else class="size-4" />
              <span aria-live="polite">{{ importingExcel ? 'Excel 导入中' : '工具箱' }}</span>
              <ChevronDown v-if="!importingExcel" class="size-3.5 opacity-50" />
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end" class="w-80 p-1.5">
            <UiDropdownMenuLabel class="px-2 py-2">
              <span class="block text-sm font-semibold text-foreground">工作台工具箱</span>
              <span class="mt-0.5 block text-xs font-normal text-muted-foreground">集中处理批量录入、数据导出和项目维护</span>
            </UiDropdownMenuLabel>
            <UiDropdownMenuSeparator />
            <template v-if="!isTranslator && !isProductor">
              <UiDropdownMenuLabel class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">批量录入</UiDropdownMenuLabel>
              <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" :disabled="importingJson || isGlobalEditing" @click="triggerJsonImport">
                <Loader2 v-if="importingJson" class="mt-0.5 size-4 shrink-0 animate-spin" />
                <Upload v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">{{ importingJson ? '正在导入 JSON' : '导入多语言 JSON' }}</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">一次选择多个语言文件并合并词条</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" :disabled="importingObjectJson || isGlobalEditing" @click="openObjectImportModal">
                <Loader2 v-if="importingObjectJson" class="mt-0.5 size-4 shrink-0 animate-spin" />
                <Copy v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">粘贴对象</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">粘贴代码对象并导入指定语言</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" :disabled="isGlobalEditing || importingExcel" @click="triggerExcelImport">
                <Loader2 v-if="importingExcel" class="mt-0.5 size-4 shrink-0 animate-spin" />
                <Upload v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">{{ importingExcel ? '正在导入 Excel' : '导入 Excel' }}</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">从表格批量创建词条和译文</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuSeparator />
              <UiDropdownMenuLabel class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">数据导出</UiDropdownMenuLabel>
              <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" @click="openExportModal">
                <Download class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">导出多语言 JSON</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">按语言生成文件并打包为 ZIP</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" @click="exportToExcel">
                <Download class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">导出为 Excel</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">导出筛选结果或当前选中词条</span>
                </span>
              </UiDropdownMenuItem>
            </template>
            <UiDropdownMenuSeparator v-if="!isTranslator && !isProductor" />
            <UiDropdownMenuLabel class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">词条与项目</UiDropdownMenuLabel>
            <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" :disabled="isGlobalEditing" @click="openBatchAddDialog">
              <ListPlus class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0">
                <span class="block text-sm font-medium">快捷批量创建</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">粘贴多行原文，预览后统一创建</span>
              </span>
            </UiDropdownMenuItem>
            <UiDropdownMenuItem
              v-if="!isTranslator"
              class="items-start gap-3 px-2 py-2.5"
              @click="router.push({ path: '/project-logs', query: { project: projectId } })"
            >
              <Activity class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0">
                <span class="block text-sm font-medium">操作日志</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">查看项目内词条的变更记录</span>
              </span>
            </UiDropdownMenuItem>
            <UiDropdownMenuItem v-if="isAdmin" class="items-start gap-3 px-2 py-2.5" @click="showSettingsModal = true">
              <Wand2 class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0">
                <span class="block text-sm font-medium">AI 提示词配置</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">调整当前项目的 AI 翻译规则</span>
              </span>
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>

        <UiButton
          v-if="!isGlobalEditing"
          variant="secondary"
          @click="enterEditMode"
          class="rounded-xl border-primary/20 text-primary hover:bg-primary/5"
        >
          <Edit3 class="w-4 h-4 mr-2" />
          进入编辑模式
        </UiButton>

        <div v-else class="flex gap-1 rounded-xl border border-primary/20 bg-primary/[0.07] p-1 animate-in fade-in duration-200">
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
          class="rounded-xl"
        >
          <Plus class="w-4 h-4 mr-2" />
          新建词条
        </UiButton>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:max-w-2xl">
        <div class="flex items-center justify-between rounded-lg bg-muted/55 px-3 py-2">
          <span class="text-muted-foreground">词条总量</span>
          <strong class="font-mono text-sm text-foreground">{{ visibleTerms.length }}</strong>
        </div>
        <div class="flex items-center justify-between rounded-lg bg-amber-500/8 px-3 py-2">
          <span class="text-amber-700 dark:text-amber-300">待补译</span>
          <strong class="font-mono text-sm text-amber-700 dark:text-amber-300">{{ pendingTermCount }}</strong>
        </div>
        <div class="flex items-center justify-between rounded-lg bg-sky-500/8 px-3 py-2">
          <span class="text-sky-700 dark:text-sky-300">可校对</span>
          <strong class="font-mono text-sm text-sky-700 dark:text-sky-300">{{ readyTermCount }}</strong>
        </div>
        <div class="flex items-center gap-2 rounded-lg bg-emerald-500/8 px-3 py-2">
          <span class="shrink-0 text-emerald-700 dark:text-emerald-300">已发布</span>
          <div class="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-emerald-500/15">
            <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${publishedRate}%` }" />
          </div>
          <strong class="font-mono text-sm text-emerald-700 dark:text-emerald-300">{{ publishedRate }}%</strong>
        </div>
      </div>

    </header>

    <!-- 顶栏过滤器和批量操作栏 -->
    <section aria-label="词条筛选与批量操作" class="shrink-0 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div class="grid gap-3 p-3 lg:grid-cols-12 lg:p-4">
        <div class="relative lg:col-span-4">
          <label for="term-search" class="sr-only">搜索 Key 或模块</label>
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <UiInput
            id="term-search"
            v-model="searchQuery"
            placeholder="搜索 Key 或模块"
            class="h-10 rounded-xl bg-background pl-9 pr-9"
          />
          <button v-if="searchQuery" type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="清除 Key 或模块搜索" @click="clearSearchField('key')">
            <X class="size-3.5" />
          </button>
        </div>
        <div class="relative lg:col-span-2">
          <label for="term-search-zh" class="sr-only">搜索中文译文</label>
          <UiInput
            id="term-search-zh"
            v-model="chineseSearchQuery"
            placeholder="中文译文"
            class="h-10 rounded-xl bg-background pr-9"
          />
          <button v-if="chineseSearchQuery" type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="清除中文搜索" @click="clearSearchField('zh')">
            <X class="size-3.5" />
          </button>
        </div>
        <div class="relative lg:col-span-2">
          <label for="term-search-en" class="sr-only">搜索英文译文</label>
          <UiInput
            id="term-search-en"
            v-model="englishSearchQuery"
            placeholder="英文译文"
            class="h-10 rounded-xl bg-background pr-9"
          />
          <button v-if="englishSearchQuery" type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="清除英文搜索" @click="clearSearchField('en')">
            <X class="size-3.5" />
          </button>
        </div>

        <UiSelect v-model="selectedModule" class="lg:col-span-2">
          <UiSelectTrigger aria-label="按模块筛选" class="h-10 w-full rounded-xl bg-background lg:col-span-2">
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
          <UiSelectTrigger aria-label="按状态筛选" class="h-10 w-full rounded-xl bg-background lg:col-span-2">
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

      <!-- 筛选状态 / 批量操作栏：保持固定高度，避免选择时页面跳动 -->
      <div class="min-h-[52px] border-t border-border/70 bg-muted/25">
        <div
          v-if="selectedCount > 0"
          class="flex min-h-[52px] items-center gap-x-2 overflow-x-auto px-3 py-2 lg:px-4"
        >
          <UiTooltipProvider>
            <UiTooltip>
              <UiTooltipTrigger as-child>
                <UiButton
                  variant="outline"
                  size="icon"
                  class="size-7 rounded-full"
                  aria-label="取消选中"
                  title="取消选中"
                  @click="clearSelectedTerms"
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
              :aria-label="`${selectedCount} 已选中`"
            >
              {{ selectedCount }}
            </UiBadge>
            项已选中
          </section>

          <UiSeparator class="h-5 mx-1" orientation="vertical" />

          <div class="flex items-center gap-x-2 whitespace-nowrap">
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
              @click="batchApproveReview"
              :disabled="isBatchApprovingReview"
              class="border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isBatchApprovingReview" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <CheckCircle2 v-else class="w-3.5 h-3.5 mr-1.5" />
              批量校对通过 {{ reviewableSelectedIds.length > 0 ? `(${reviewableSelectedIds.length})` : '' }}
            </UiButton>

            <UiButton
              variant="outline"
              size="sm"
              @click="triggerBatchPublish"
              :disabled="isBatchPublishing"
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
        <div v-else class="flex min-h-[52px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted-foreground">
          <div class="flex items-center gap-2">
            <span class="size-1.5 rounded-full bg-primary/60" />
            <span v-if="hasActiveFilters">筛选后显示 {{ filteredTerms.length }} / {{ visibleTerms.length }} 条词条</span>
            <span v-else>勾选词条后可进行批量翻译、校对、发布或删除</span>
          </div>
          <UiButton v-if="hasActiveFilters" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="clearAllFilters">
            <X class="mr-1 size-3.5" />
            清除全部筛选
          </UiButton>
        </div>
      </div>

      <div
        v-if="canSelectAllFiltered"
        class="flex flex-wrap items-center justify-center gap-2 border-t border-primary/15 bg-primary/[0.04] px-3 py-2 text-sm text-muted-foreground"
      >
        <span>已选择当前页 {{ paginatedTerms.length }} 条。</span>
        <UiButton variant="link" size="sm" class="h-auto px-1 py-0 text-primary" @click="selectAllFilteredTerms">
          选择符合当前筛选条件的全部 {{ filteredTerms.length }} 条
        </UiButton>
      </div>
    </section>

    <!-- 词条表格 -->
    <section aria-label="词条列表" class="relative flex h-[clamp(620px,72svh,900px)] min-h-[620px] shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div class="min-h-0 flex-1 overflow-hidden">
      <UiTable class="relative min-w-max">
        <UiTableCaption class="sr-only">当前项目的多语言词条、流程状态与更新时间</UiTableCaption>
        <UiTableHeader class="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/80">
          <UiTableRow class="hover:bg-transparent">
            <UiTableHead class="w-10 px-3 text-center xl:sticky xl:left-0 xl:z-30 xl:bg-muted/95">
              <UiCheckbox
                :modelValue="checkboxAllState"
                @update:modelValue="handleSelectAll"
                aria-label="选择当前页全部词条"
              />
            </UiTableHead>
            <UiTableHead class="w-24 text-center xl:sticky xl:left-10 xl:z-30 xl:bg-muted/95">操作</UiTableHead>
            <UiTableHead class="min-w-[220px] border-r border-border/70 xl:sticky xl:left-[136px] xl:z-30 xl:bg-muted/95">词条标识与说明</UiTableHead>
            <UiTableHead class="w-28 text-center">状态</UiTableHead>
            <UiTableHead v-for="lang in targetLanguages" :key="lang.code" class="min-w-[220px] py-2">
              <div class="flex items-center gap-2">
                <span class="font-medium text-foreground/80">{{ lang.name }}</span>
                <span class="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ lang.code }}</span>
                <span v-if="lang.code === sourceLanguageCode" class="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">源</span>
              </div>
            </UiTableHead>
            <UiTableHead class="w-36 text-muted-foreground">创建时间</UiTableHead>
            <UiTableHead class="w-36 text-muted-foreground">更新时间</UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          <UiTableRow
            v-for="term in paginatedTerms"
            :key="term.id"
            class="group border-b border-border/70 transition-colors hover:bg-muted/35"
            :class="{
              'bg-primary/[0.03] dark:bg-primary/[0.05]': isTermSelected(term),
              'bg-amber-50/30 dark:bg-amber-920/10 shadow-[inset_2px_0_0_0_#f59e0b]': stagedChangeOriginals.has(term.id),
              'bg-emerald-50/80 dark:bg-emerald-950/20': recentlyCreatedTermIds.includes(String(term.id))
            }"
          >
            <!-- 多选列 -->
            <UiTableCell class="w-10 bg-card px-3 py-3 text-center align-top transition-colors group-hover:bg-muted/35 xl:sticky xl:left-0 xl:z-10">
              <UiCheckbox
                :modelValue="isTermSelected(term)"
                @update:modelValue="toggleSelectTerm(term.id, $event)"
                :aria-label="`选择词条 ${term.key || term.id}`"
              />
            </UiTableCell>

            <!-- 操作列 -->
            <UiTableCell class="w-24 bg-card p-2 text-center align-top transition-colors group-hover:bg-muted/35 xl:sticky xl:left-10 xl:z-10">
              <UiTooltipProvider>
                <div class="flex items-center justify-center gap-1.5 pt-1">
                  <!-- Staged Actions (Wait for review) -->
                  <template v-if="stagedChangeOriginals.has(term.id)">
                    <UiTooltip>
                      <UiTooltipTrigger as-child>
                        <UiButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          @click="persistStagedRow(term)"
                          class="size-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                          :aria-label="`接受并保存词条 ${term.key}`"
                        >
                          <CheckCircle2 class="w-3.5 h-3.5" />
                        </UiButton>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">接受并保存</UiTooltipContent>
                    </UiTooltip>

                    <UiTooltip>
                      <UiTooltipTrigger as-child>
                        <UiButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          @click="discardStagedRow(term)"
                          class="size-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          :aria-label="`撤销词条 ${term.key} 的翻译`"
                        >
                          <RotateCcw class="w-3.5 h-3.5" />
                        </UiButton>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">撤销翻译</UiTooltipContent>
                    </UiTooltip>
                  </template>

                  <!-- Normal Actions -->
                  <template v-else>
                    <!-- Edit/Detail Button -->
                    <UiTooltip>
                      <UiTooltipTrigger as-child>
                        <UiButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          @click="openDrawer(term)"
                          class="size-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          :aria-label="`打开词条 ${term.key} 的详情`"
                        >
                          <Edit3 class="w-3.5 h-3.5" />
                        </UiButton>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">配置详情</UiTooltipContent>
                    </UiTooltip>

                    <!-- Translate Button: Developer cannot self-translate -->
                    <UiTooltip v-if="term.status !== 'published' && !isDeveloper">
                      <UiTooltipTrigger as-child>
                        <UiButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          @click="translateRow(term)"
                          :disabled="translatingTerms.has(term.id)"
                          class="size-8 text-primary/70 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                          :aria-label="translatingTerms.has(term.id) ? `正在翻译词条 ${term.key}` : `AI 翻译词条 ${term.key}`"
                        >
                          <Loader2 v-if="translatingTerms.has(term.id)" class="w-3.5 h-3.5 animate-spin" />
                          <Wand2 v-else class="w-3.5 h-3.5" />
                        </UiButton>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">AI 翻译</UiTooltipContent>
                    </UiTooltip>
                    <UiTooltip v-else>
                      <UiTooltipTrigger as-child>
                          <UiButton type="button" variant="ghost" size="icon" disabled class="size-8 text-muted-foreground/40" aria-label="当前不可使用 AI 翻译">
                            <Wand2 class="w-3.5 h-3.5" />
                          </UiButton>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">请通过配置详情进行更新</UiTooltipContent>
                    </UiTooltip>

                    <UiAlertDialog v-if="term.status !== 'published' && !isTranslator && !isProductor" @update:open="val => presentDeletingId = val ? term.id : null">
                      <UiTooltip :open="presentDeletingId === term.id ? false : undefined">
                        <UiTooltipTrigger as-child v-if="isAdmin || isDeveloper">
                          <UiAlertDialogTrigger as-child>
                            <UiButton type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" :aria-label="`删除词条 ${term.key}`">
                              <Trash2 class="w-3.5 h-3.5" />
                            </UiButton>
                          </UiAlertDialogTrigger>
                        </UiTooltipTrigger>
                        <UiTooltipTrigger as-child v-else>
                          <UiButton type="button" variant="ghost" size="icon" disabled class="size-8 text-muted-foreground/30" aria-label="无权删除词条">
                            <Trash2 class="w-3.5 h-3.5" />
                          </UiButton>
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
                        <UiButton type="button" variant="ghost" size="icon" disabled class="size-8 text-muted-foreground/30" aria-label="当前不可删除词条">
                          <Trash2 class="w-3.5 h-3.5" />
                        </UiButton>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top">{{ term.status === 'published' ? '不可删除线上已发布项' : '无权限操作' }}</UiTooltipContent>
                    </UiTooltip>
                  </template>
                </div>
              </UiTooltipProvider>
            </UiTableCell>

            <!-- 词条基础信息列 (Optimized Layout) -->
            <UiTableCell class="min-w-[220px] border-r border-border/70 bg-card p-3 align-top transition-colors group-hover:bg-muted/35 xl:sticky xl:left-[136px] xl:z-10" :class="{ 'bg-primary/[0.06]': (isGlobalEditing && isTermSelected(term) && term.status !== 'published') || stagedChangeOriginals.has(term.id) }">
              <div class="flex flex-col gap-1 min-w-0">
                <!-- Row 1: Module & Key & Sidebar Toggle -->
                <div class="flex items-center gap-1.5 min-w-0 h-6">
                  <template v-if="(isGlobalEditing && isTermSelected(term) && term.status !== 'published') || stagedChangeOriginals.has(term.id)">
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
                      <span v-if="term.module" class="shrink-0 rounded-md border border-primary/10 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-primary">
                        {{ term.module }}
                      </span>
                      <span
                        class="flex-1 truncate font-mono text-[13px] font-semibold text-foreground"
                        :title="term.key"
                      >
                        {{ term.key || 'Untitled_Key' }}
                      </span>
                    </div>
                  </template>
                </div>

                <!-- Row 2: Subtle Description -->
                <div class="min-w-0 h-5">
                  <template v-if="(isGlobalEditing && isTermSelected(term) && term.status !== 'published') || stagedChangeOriginals.has(term.id)">
                    <UiInput
                      v-model="term.description"
                      class="h-5 text-[10px] w-full px-1 border-gray-100 dark:border-zinc-800 bg-background/50 focus:bg-background"
                      placeholder="添加描述..."
                    />
                  </template>
                  <template v-else-if="term.description">
                    <p class="line-clamp-1 truncate px-0.5 text-[11px] leading-tight text-muted-foreground" :title="term.description">
                      {{ term.description }}
                    </p>
                  </template>
                </div>
              </div>
            </UiTableCell>

            <!-- 状态列 -->
            <UiTableCell class="align-top p-3 text-center w-32" :class="{ 'bg-primary/[0.02]': (isGlobalEditing && isTermSelected(term) && term.status !== 'published') || stagedChangeOriginals.has(term.id) }">
              <div class="flex justify-center pt-1">
                <div
                  class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
                  :class="[
                    term.status === 'draft' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                    term.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    term.status === 'review' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  ]"
                >
                  <span class="size-1.5 rounded-full" :class="getStatusColor(term.status)" />
                  {{ statusOptions.find(o => o.value === term.status)?.label }}
                </div>
              </div>
            </UiTableCell>

            <!-- 多语言翻译列 -->
            <UiTableCell v-for="lang in targetLanguages" :key="lang.code" class="align-top p-2 group/cell" :class="{ 'bg-primary/[0.01]': (isGlobalEditing && isTermSelected(term) && term.status !== 'published') || stagedChangeOriginals.has(term.id) }">
              <div class="min-h-[44px] relative">
                <template v-if="(isGlobalEditing && isTermSelected(term) && term.status !== 'published') || stagedChangeOriginals.has(term.id)">
                  <UiTextarea
                    v-model="term.translations[lang.code]"
                    :disabled="isDeveloper"
                    @update:model-value="handleTranslationUpdate(term)"
                    class="w-full min-h-[44px] p-1.5 text-xs shadow-none bg-background border-primary/20 focus-visible:ring-1 focus-visible:ring-primary/20 resize-none transition-all leading-relaxed"
                    :class="hasTranslationPlaceholderMismatch(term, lang.code) ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                    :placeholder="'输入 ' + lang.name + '...'"
                  />
                </template>
                <template v-else>
                  <div
                    class="w-full min-h-[44px] p-1.5 text-xs break-words whitespace-pre-wrap rounded border border-transparent transition-colors group-hover/cell:bg-gray-50/80"
                    :class="[
                      !term.translations[lang.code] ? 'text-muted-foreground/55' : 'text-foreground/80',
                      hasTranslationPlaceholderMismatch(term, lang.code) ? 'border-destructive/40 bg-destructive/5 text-destructive dark:text-destructive' : ''
                    ]"
                  >
                    {{ term.translations[lang.code] || '尚未填写' }}
                  </div>
                </template>
                <p v-if="hasTranslationPlaceholderMismatch(term, lang.code)" class="mt-1 text-[10px] leading-tight text-destructive">
                  <span v-if="getTranslationPlaceholderDiff(term, lang.code).missing.length">
                    缺少 {{ getTranslationPlaceholderDiff(term, lang.code).missing.join(', ') }}
                  </span>
                  <span v-if="getTranslationPlaceholderDiff(term, lang.code).extra.length">
                    {{ getTranslationPlaceholderDiff(term, lang.code).missing.length ? '，' : '' }}多出 {{ getTranslationPlaceholderDiff(term, lang.code).extra.join(', ') }}
                  </span>
                </p>
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
                <div class="flex size-14 items-center justify-center rounded-2xl border border-dashed bg-muted/40">
                  <Search class="size-6 opacity-40" />
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-foreground">{{ terms.length === 0 ? '当前项目还没有词条' : '没有匹配的词条' }}</p>
                  <p class="text-xs opacity-70">{{ terms.length === 0 ? '创建第一条词条，开始建立多语言内容。' : '调整关键词、模块或状态筛选后再试。' }}</p>
                </div>
                <UiButton v-if="terms.length === 0 && (isAdmin || isDeveloper)" variant="outline" size="sm" class="mt-2" @click="showAddTermModal = true">
                  <Plus class="size-3.5 mr-1.5" />
                  新建词条
                </UiButton>
                <UiButton v-else-if="hasActiveFilters" variant="outline" size="sm" class="mt-2" @click="clearAllFilters">
                  <X class="mr-1.5 size-3.5" />
                  清除全部筛选
                </UiButton>
              </div>
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-card px-4 py-3 text-sm">
        <div class="text-xs text-muted-foreground">
          共 {{ filteredTerms.length }} 条
          <template v-if="filteredTerms.length > 0">
            ，当前 {{ pageStart }}-{{ pageEnd }} 条
          </template>
          <template v-if="selectedCount > 0">
            ，已选 {{ selectedCount }} 条
          </template>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">每页</span>
            <UiSelect :model-value="String(pageSize)" @update:model-value="value => pageSize = Number(value)">
              <UiSelectTrigger class="h-8 w-[76px]">
                <UiSelectValue :placeholder="String(pageSize)" />
              </UiSelectTrigger>
              <UiSelectContent side="top">
                <UiSelectItem v-for="size in PAGE_SIZES" :key="size" :value="String(size)">
                  {{ size }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div class="min-w-[88px] text-center text-xs font-medium text-muted-foreground" aria-live="polite">
            第 {{ currentPage }} / {{ totalPages }} 页
          </div>

          <div class="flex items-center gap-1">
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="第一页" :disabled="currentPage === 1" @click="goToFirstPage">
              <ChevronsLeft class="h-4 w-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="上一页" :disabled="currentPage === 1" @click="goToPreviousPage">
              <ChevronLeft class="h-4 w-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="下一页" :disabled="currentPage === totalPages" @click="goToNextPage">
              <ChevronRight class="h-4 w-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="最后一页" :disabled="currentPage === totalPages" @click="goToLastPage">
              <ChevronsRight class="h-4 w-4" />
            </UiButton>
          </div>
        </div>
      </div>

      <!-- 绝对定位的 Empty / Loading 覆盖层，始终在视口水平居中，无视表格向右滚动 -->
      <div v-if="loadingTerms" class="absolute inset-0 top-[40px] z-20 flex items-center justify-center bg-card/75 backdrop-blur-[1px]" role="status" aria-live="polite">
        <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/80 bg-card p-6 text-muted-foreground shadow-lg">
          <Loader2 class="size-8 animate-spin text-primary" />
          <p class="text-sm font-medium">正在加载词条数据...</p>
        </div>
      </div>

    </section>

    <!-- 快捷批量创建模态框 -->
    <UiDialog :open="showBatchAddModal" @update:open="handleBatchAddOpenChange">
      <UiDialogContent class="flex max-h-[90svh] flex-col sm:max-w-5xl">
        <UiDialogHeader>
          <UiDialogTitle>
            {{ batchAddStep === 'input' ? '快捷批量创建词条' : '预览并补全词条' }}
          </UiDialogTitle>
          <UiDialogDescription>
            <template v-if="batchAddStep === 'input'">
              每行输入一条原文，也可以使用“Key | 原文”格式同时填写 Key。
            </template>
            <template v-else>
              创建前请补全必填信息并处理重复项。创建成功后将直接返回正常列表。
            </template>
          </UiDialogDescription>
        </UiDialogHeader>

        <div v-if="batchAddStep === 'input'" class="min-h-0 space-y-4 overflow-y-auto py-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <UiLabel for="batch-source-language">原文语言</UiLabel>
              <UiSelect v-model="batchSourceLangCode">
                <UiSelectTrigger id="batch-source-language">
                  <UiSelectValue placeholder="选择原文语言" />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem v-for="lang in targetLanguages" :key="lang.code" :value="lang.code">
                    {{ lang.name }}（{{ lang.code }}）
                  </UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="space-y-2">
              <UiLabel for="batch-default-module">默认模块（可选）</UiLabel>
              <UiInput id="batch-default-module" v-model="batchDefaultModule" maxlength="100" placeholder="例如：common、auth" />
            </div>
          </div>

          <div class="space-y-2">
            <UiLabel for="batch-create-content">粘贴清单，一行一条</UiLabel>
            <UiTextarea
              id="batch-create-content"
              v-model="batchAddText"
              placeholder="confirm_delete | 确认删除吗？&#10;save_success | 保存成功&#10;网络连接失败"
              class="min-h-[260px] resize-none font-mono text-sm leading-relaxed"
              :aria-invalid="Boolean(batchAddError)"
              aria-describedby="batch-create-help batch-create-error"
            />
            <div id="batch-create-help" class="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>没有提供 Key 的内容可在下一步补全。</span>
              <span>单次最多 {{ BATCH_CREATE_LIMIT }} 条</span>
            </div>
          </div>
        </div>

        <div v-else class="min-h-0 flex-1 space-y-3 overflow-hidden py-4">
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>共 {{ batchCreateRows.length }} 条，{{ validBatchCreateCount }} 条可以创建</span>
            <span v-if="batchRowErrors.size" class="text-destructive">{{ batchRowErrors.size }} 条需要处理</span>
          </div>

          <div class="max-h-[55svh] overflow-auto rounded-lg border">
            <UiTable>
              <UiTableHeader class="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <UiTableRow>
                  <UiTableHead class="w-12 text-center">#</UiTableHead>
                  <UiTableHead class="min-w-[220px]">Key</UiTableHead>
                  <UiTableHead class="min-w-[150px]">模块</UiTableHead>
                  <UiTableHead class="min-w-[260px]">{{ targetLanguages.find(lang => lang.code === batchSourceLangCode)?.name || '原文' }}</UiTableHead>
                  <UiTableHead class="min-w-[200px]">描述（可选）</UiTableHead>
                  <UiTableHead class="min-w-[200px]">检查结果</UiTableHead>
                  <UiTableHead class="w-16"><span class="sr-only">操作</span></UiTableHead>
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                <UiTableRow v-for="(row, index) in batchCreateRows" :key="row.clientId">
                  <UiTableCell class="text-center text-xs text-muted-foreground">{{ index + 1 }}</UiTableCell>
                  <UiTableCell>
                    <UiInput
                      v-model="row.key"
                      maxlength="255"
                      class="font-mono"
                      placeholder="必填，例如 confirm_delete"
                      :aria-label="`第 ${index + 1} 条 Key`"
                      :aria-invalid="batchRowErrors.has(row.clientId)"
                    />
                  </UiTableCell>
                  <UiTableCell>
                    <UiInput v-model="row.module" maxlength="100" placeholder="可选" :aria-label="`第 ${index + 1} 条模块`" />
                  </UiTableCell>
                  <UiTableCell>
                    <UiTextarea
                      v-model="row.sourceText"
                      rows="2"
                      class="min-h-16 resize-none"
                      :aria-label="`第 ${index + 1} 条原文`"
                      :aria-invalid="batchRowErrors.has(row.clientId)"
                    />
                  </UiTableCell>
                  <UiTableCell>
                    <UiTextarea
                      v-model="row.description"
                      rows="2"
                      class="min-h-16 resize-none"
                      placeholder="使用场景或上下文"
                      :aria-label="`第 ${index + 1} 条描述`"
                    />
                  </UiTableCell>
                  <UiTableCell>
                    <span v-if="batchRowErrors.get(row.clientId)" class="text-xs text-destructive">
                      {{ batchRowErrors.get(row.clientId) }}
                    </span>
                    <span v-else class="text-xs text-emerald-600 dark:text-emerald-400">可以创建</span>
                  </UiTableCell>
                  <UiTableCell>
                    <UiButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-destructive"
                      :aria-label="`移除第 ${index + 1} 条`"
                      :disabled="isBatchCreatingTerms"
                      @click="removeBatchCreateRow(row.clientId)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </UiButton>
                  </UiTableCell>
                </UiTableRow>
              </UiTableBody>
            </UiTable>
          </div>
        </div>

        <p v-if="batchAddError" id="batch-create-error" role="alert" class="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {{ batchAddError }}
        </p>

        <UiDialogFooter class="shrink-0">
          <template v-if="batchAddStep === 'input'">
            <UiButton variant="outline" :disabled="isBatchCreatingTerms" @click="handleBatchAddOpenChange(false)">取消</UiButton>
            <UiButton :disabled="!batchAddText.trim() || !batchSourceLangCode" @click="confirmBatchAdd">下一步：预览</UiButton>
          </template>
          <template v-else>
            <UiButton variant="outline" :disabled="isBatchCreatingTerms" @click="batchAddStep = 'input'">返回修改</UiButton>
            <UiButton
              :disabled="isBatchCreatingTerms || batchCreateRows.length === 0 || batchRowErrors.size > 0"
              @click="submitBatchCreate"
            >
              <Loader2 v-if="isBatchCreatingTerms" class="mr-2 h-4 w-4 animate-spin" />
              {{ isBatchCreatingTerms ? `正在创建 ${batchCreateRows.length} 个词条` : `创建 ${validBatchCreateCount} 个词条` }}
            </UiButton>
          </template>
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
                  :class="hasTranslationPlaceholderMismatch(activeDrawerTerm, lang.code) ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                  :placeholder="'输入 ' + lang.name + ' 翻译...'"
                />
                <p v-if="hasTranslationPlaceholderMismatch(activeDrawerTerm, lang.code)" class="mt-1 text-[10px] leading-tight text-destructive">
                  <span v-if="getTranslationPlaceholderDiff(activeDrawerTerm, lang.code).missing.length">
                    缺少 {{ getTranslationPlaceholderDiff(activeDrawerTerm, lang.code).missing.join(', ') }}
                  </span>
                  <span v-if="getTranslationPlaceholderDiff(activeDrawerTerm, lang.code).extra.length">
                    {{ getTranslationPlaceholderDiff(activeDrawerTerm, lang.code).missing.length ? '，' : '' }}多出 {{ getTranslationPlaceholderDiff(activeDrawerTerm, lang.code).extra.join(', ') }}
                  </span>
                </p>
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
                  v-if="canApproveReviewInDrawer"
                  variant="outline"
                  class="flex-1 border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  :disabled="savingDrawer || approvingReview"
                  @click="approveDrawerReview"
                >
                  <Loader2 v-if="approvingReview" class="w-4 h-4 mr-2 animate-spin" />
                  <CheckCircle2 v-else class="w-4 h-4 mr-2" />
                  {{ isDrawerDirty ? '保存并校对通过' : '校对通过' }}
                </UiButton>
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
          <UiAlertDialogDescription>该词条已被发布过。修改保存后，其状态将退回为【待发布】，原有的线上版本将被新内容覆盖。确认继续吗？</UiAlertDialogDescription>
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

    <!-- 粘贴对象导入 -->
    <UiDialog :open="showObjectImportModal" @update:open="val => showObjectImportModal = val">
      <UiDialogContent class="sm:max-w-2xl z-[100]">
        <UiDialogHeader>
          <UiDialogTitle>粘贴对象导入</UiDialogTitle>
          <UiDialogDescription>
            粘贴对象后导入为指定语言的词条翻译，支持未加双引号的对象 key。
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-4 py-2">
          <div class="grid gap-2">
            <UiLabel>导入语言</UiLabel>
            <UiSelect v-model="objectImportLangCode">
              <UiSelectTrigger class="w-full">
                <UiSelectValue placeholder="选择语言" />
              </UiSelectTrigger>
              <UiSelectContent class="z-[200]">
                <UiSelectItem v-for="lang in targetLanguages" :key="lang.code" :value="lang.code">
                  {{ lang.name }} ({{ lang.code }})
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div class="grid gap-2">
            <UiLabel>对象 JSON</UiLabel>
            <UiTextarea
              v-model="objectImportText"
              class="h-[320px] min-h-[320px] resize-none overflow-y-auto font-mono text-xs leading-relaxed"
              placeholder="{
  common: {
    confirm: '确认',
    cancel: '取消'
  },
  auth: {
    login: {
      title: '登录'
    }
  }
}"
            />
            <p class="text-xs text-muted-foreground">
              顶层对象会作为模块名；更深层对象会用点号合成 key，例如 auth.login.title。
            </p>
          </div>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="showObjectImportModal = false">取消</UiButton>
          <UiButton :disabled="importingObjectJson || !objectImportText.trim() || !objectImportLangCode" @click="submitObjectImport">
            <Loader2 v-if="importingObjectJson" class="w-4 h-4 mr-2 animate-spin" />
            确认导入
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- 导出模态框 -->
    <UiDialog :open="showExportModal" @update:open="val => showExportModal = val">
      <UiDialogContent class="sm:max-w-md z-[100]">
        <UiDialogHeader>
          <UiDialogTitle>导出多语言 JSON</UiDialogTitle>
          <UiDialogDescription>
            请选择要导出的语言。每种语言生成一个 JSON 文件，并统一打包为 ZIP 下载。
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
          <UiButton variant="outline" :disabled="isExportingJson" @click="closeExportModal">取消</UiButton>
          <UiButton
            class="bg-green-600 text-white hover:bg-green-700"
            :disabled="isExportingJson || selectedExportLangs.length === 0"
            @click="confirmExport"
          >
            <Loader2 v-if="isExportingJson" class="mr-2 size-4 animate-spin" />
            {{ isExportingJson ? '正在打包…' : `打包下载 (${selectedExportLangs.length})` }}
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
            <span class="text-sm font-normal text-muted-foreground">— {{ selectedCount }} 个词条</span>
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
            您即将删除选中的 <strong class="text-foreground">{{ selectedCount }}</strong> 个词条。此操作不可恢复，是否继续？
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
