<script setup lang="ts">
import type { BatchCreateResult, Project, ProjectLanguage, TermDTO, TermItem, Translation } from '@/types/domain'
import { Activity, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Download, Edit3, FolderKanban, ListPlus, Loader2, Plus, RotateCcw, Save, Search, Trash2, Upload, Wand2, Wrench, X } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { getLocaleRelease, getPublicLocaleUrl, publishLocaleRelease as requestPublishLocaleRelease } from '@/api/locales'

import { getProject, listProjectLanguages, listProjects, updateProject } from '@/api/projects'

import { batchCreateTerms, batchUpdateTerms, copyTermExport, createTerm, downloadTermsExcel, downloadTermsJson, executeTermBulk, listTerms, previewTermBulk, deleteTerm as requestDeleteTerm, publishTerm as requestPublishTerm, updateTerm } from '@/api/terms'
import { useDiscardConfirmation } from '@/composables/use-discard-confirmation'
import { usePermission } from '@/composables/use-permission'
import { useRequestScope } from '@/composables/use-request-scope'
import { useTermImport } from '@/composables/use-term-import'
import { useTermTranslation } from '@/composables/use-term-translation'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/constants/pagination'
import { requestAITranslation } from '@/lib/ai'
import { fetchAvailableLanguages } from '@/lib/available-languages'
import { errorMessage } from '@/lib/errors'
import { diffPlaceholders, extractPlaceholders } from '@/lib/placeholders'
import { captureTermDraft, restoreTermDraft } from '@/lib/term-draft'
import { DEFAULT_TRANSLATION_PROMPT, mapApiTerm, termUpdatePayload } from '@/lib/terms'
import TermEditorSheet from './components/TermEditorSheet.vue'
import TermExportDialog from './components/TermExportDialog.vue'

defineOptions({ name: 'Workbench' })

interface BatchCreateRow {
  clientId: string
  key: string
  module: string
  description: string
  sourceText: string
}

interface TermStatusCounts {
  draft: number
  pending: number
  review: number
  published: number
}

interface TermListResponse {
  items: TermDTO[]
  total: number
  page: number
  page_size: number
  total_pages: number
  status_counts: TermStatusCounts
  modules: string[]
  project_summary: {
    total: number
    status_counts: TermStatusCounts
    ready_review_count: number
  }
}

type BulkOperation = 'approve_review' | 'publish' | 'delete'

interface TermBulkScope {
  mode: 'explicit' | 'filtered'
  ids?: number[]
  filter?: Record<string, string | boolean | undefined>
  excluded_ids?: number[]
}

interface TermBulkResult {
  operation: BulkOperation
  matched: number
  executable: number
  succeeded: number
  skipped: number
  status_counts: TermStatusCounts
  skip_reasons: Record<string, number>
}

type Language = ProjectLanguage

interface LocaleRelease {
  id: number
  version: number
  created_at: string
  files: Array<{ language_code: string }>
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
  if (firstFilledTranslation)
    return firstFilledTranslation

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
      if (diff.missing.length)
        parts.push(`缺少 ${diff.missing.join(', ')}`)
      if (diff.extra.length)
        parts.push(`多出 ${diff.extra.join(', ')}`)
      return `${lang.name}: ${parts.join('，')}`
    })
    .join('；')
}

function placeholderInstructionForTerm(term: TermItem) {
  const placeholders = extractPlaceholders(getPlaceholderSource(term))
  if (!placeholders.length)
    return ''

  return `\n\n占位符保护要求：本词条包含代码运行时变量 ${placeholders.join(', ')}。所有目标语言译文必须原样保留这些占位符；不要翻译、删除、重命名、增减、改变大小写或改变花括号。可以根据语序移动位置，但占位符文本必须完全一致。`
}

const route = useRoute()
const router = useRouter()
const { role, can } = usePermission()

const projectId = computed(() => typeof route.query.project === 'string' ? route.query.project : '')
const requestScope = useRequestScope(() => projectId.value)
const translationService = useTermTranslation(requestAITranslation, requestScope.capture)
// 角色仅用于译员的草稿可见性；操作权限统一使用 can / v-permission。
const isTranslator = computed(() => role.value === 'translator')

// Project list for the switcher
const projects = ref<Project[]>([])
const loadingProjects = ref(false)
const showLocaleReleaseDialog = ref(false)
const showLocalePublishConfirm = ref(false)
const localeRelease = ref<LocaleRelease | null>(null)
const localeReleaseLoading = ref(false)
const localeReleaseError = ref('')
const publishingLocaleRelease = ref(false)

async function openLocaleReleaseDialog() {
  showLocaleReleaseDialog.value = true
  localeReleaseLoading.value = true
  localeReleaseError.value = ''
  localeRelease.value = null
  try {
    const response = await getLocaleRelease<LocaleRelease | null>(projectId.value)
    localeRelease.value = response.data
  }
  catch (error: unknown) {
    localeReleaseError.value = errorMessage(error) || '读取线上版本失败'
  }
  finally {
    localeReleaseLoading.value = false
  }
}

function localePublicUrl(languageCode: string) {
  return getPublicLocaleUrl(currentProject.value?.code || '', languageCode)
}

async function copyLocaleUrl(languageCode: string) {
  try {
    await navigator.clipboard.writeText(localePublicUrl(languageCode))
    toast.success('链接已复制')
  }
  catch {
    toast.error('复制失败，请手动复制链接')
  }
}

async function publishLocaleRelease() {
  if (!can('locale.publish'))
    return
  showLocalePublishConfirm.value = false
  publishingLocaleRelease.value = true
  localeReleaseError.value = ''
  try {
    const response = await requestPublishLocaleRelease<LocaleRelease>(projectId.value)
    localeRelease.value = response.data
    toast.success('语言文件已发布', { description: `当前版本 v${response.data.version}` })
  }
  catch (error: unknown) {
    localeReleaseError.value = errorMessage(error) || '发布失败，线上版本未改变'
    toast.error('语言文件发布失败')
  }
  finally {
    publishingLocaleRelease.value = false
  }
}

async function fetchProjects() {
  loadingProjects.value = true
  try {
    const res = await listProjects<Project[]>()
    projects.value = res.data ?? []

    // If no project in URL, try to auto-load the last one or the first one
    if (!projectId.value && projects.value.length > 0) {
      const lastId = localStorage.getItem('last_project_id')
      const targetId = lastId && projects.value.some(p => String(p.id) === lastId)
        ? lastId
        : String(projects.value[0]?.id || '')

      router.replace({ query: { ...route.query, project: targetId } })
    }
  }
  catch (e) {
    console.error('Failed to load projects', e)
  }
  finally {
    loadingProjects.value = false
  }
}

const terms = ref<TermItem[]>([])
// Keep the table covered while the workbench resolves the project and its data.
// This prevents an empty table flash before the first terms request starts.
const loadingTerms = ref(true)
const totalTerms = ref(0)
const totalPages = ref(1)
const modules = ref<string[]>([])
const filteredStatusCounts = ref<TermStatusCounts>({ draft: 0, pending: 0, review: 0, published: 0 })
const projectSummary = ref({
  total: 0,
  status_counts: { draft: 0, pending: 0, review: 0, published: 0 } as TermStatusCounts,
  ready_review_count: 0,
})
let latestTermsRequest = 0

function getTermFilterParams() {
  return {
    search: searchQuery.value.trim() || undefined,
    chinese_search: chineseSearchQuery.value.trim() || undefined,
    english_search: englishSearchQuery.value.trim() || undefined,
    module: selectedModule.value !== 'all' ? selectedModule.value : undefined,
    status: selectedStatus.value !== 'all' ? selectedStatus.value : undefined,
    exclude_draft: isTranslator.value || undefined,
  }
}

function getTermListParams(page = currentPage.value, size = pageSize.value) {
  return {
    page,
    page_size: size,
    ...getTermFilterParams(),
  }
}

async function loadProjectLanguages() {
  const ticket = requestScope.request()
  if (!ticket.context) {
    ticket.release()
    return
  }
  try {
    const res = await listProjectLanguages<ProjectLanguage[]>(ticket.context, { signal: ticket.signal })
    if (ticket.isCurrent())
      targetLanguages.value = res.data ?? []
  }
  catch (error) {
    if (ticket.isCurrent()) {
      targetLanguages.value = []
      toast.error('获取项目语言失败', { description: errorMessage(error) })
    }
  }
  finally { ticket.release() }
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
  if (!projectId.value)
    return
  if (isGlobalEditing.value)
    return
  const ticket = requestScope.request()
  const requestId = ++latestTermsRequest
  loadingTerms.value = true
  try {
    const res = await listTerms<TermListResponse>(ticket.context, {

      signal: ticket.signal,
      params: getTermListParams(),
    })
    if (requestId !== latestTermsRequest || !ticket.isCurrent() || isGlobalEditing.value)
      return

    terms.value = (res.data?.items || []).map(mapApiTerm).map(term => stagedChangeOriginals.value.has(term.id) ? terms.value.find(row => row.id === term.id) || selectedTermCache.value.get(term.id) || term : term)
    totalTerms.value = Number(res.data?.total || 0)
    totalPages.value = Math.max(1, Number(res.data?.total_pages || 1))
    modules.value = res.data?.modules || []
    filteredStatusCounts.value = res.data?.status_counts || { draft: 0, pending: 0, review: 0, published: 0 }
    projectSummary.value = res.data?.project_summary || {
      total: 0,
      status_counts: { draft: 0, pending: 0, review: 0, published: 0 },
      ready_review_count: 0,
    }
    if (currentPage.value !== Number(res.data?.page || 1)) {
      currentPage.value = Number(res.data?.page || 1)
    }
    syncSelectedTermCacheFromPage()
  }
  catch (error: unknown) {
    if (requestId === latestTermsRequest && ticket.isCurrent()) {
      toast.error('获取词条失败', { description: errorMessage(error) })
    }
  }
  finally {
    ticket.release()
    if (requestId === latestTermsRequest && ticket.isCurrent())
      loadingTerms.value = false
  }
}

async function fetchAllMatchingTerms() {
  const ticket = requestScope.capture()
  const collected: TermItem[] = []
  const baseParams = getTermListParams(1, 200)
  let page = 1
  let pages = 1
  do {
    const res = await listTerms<TermListResponse>(ticket.context, {

      params: { ...baseParams, page },
    })
    if (!ticket.isCurrent())
      throw new Error('项目已切换，请重新选择词条')
    collected.push(...(res.data?.items || []).map(mapApiTerm))
    pages = Math.max(1, Number(res.data?.total_pages || 1))
    page++
  } while (page <= pages)
  return collected
}

const isSavingPrompt = ref(false)
async function saveGlobalPrompt() {
  if (isSavingPrompt.value)
    return
  if (!projectId.value || !can('project.prompt'))
    return
  isSavingPrompt.value = true
  try {
    await updateProject(projectId.value, {

      data: {
        ai_prompt: globalPrompt.value,
      },
    })
    toast.success('配置已保存', { description: '全局 AI 提示词已更新。' })
    showSettingsModal.value = false
  }
  catch (e: unknown) {
    toast.error('保存失败', { description: errorMessage(e) })
  }
  finally {
    isSavingPrompt.value = false
  }
}

async function loadProjectDetails() {
  const ticket = requestScope.request()
  if (!ticket.context) {
    ticket.release()
    return
  }
  globalPrompt.value = DEFAULT_TRANSLATION_PROMPT
  try {
    const res = await getProject<Project>(ticket.context, { signal: ticket.signal })
    if (ticket.isCurrent())
      globalPrompt.value = res.data.ai_prompt || DEFAULT_TRANSLATION_PROMPT
  }
  catch (error) {
    if (ticket.isCurrent())
      toast.error('获取项目配置失败', { description: errorMessage(error) })
  }
  finally { ticket.release() }
}

async function refreshData() {
  if (!projectId.value) {
    loadingTerms.value = false
    return
  }
  // Start the table feedback before the language/project detail requests.
  loadingTerms.value = true
  const ticket = requestScope.capture()
  await loadAvailableLanguages()
  if (!ticket.isCurrent())
    return
  await Promise.all([
    loadProjectLanguages(),
    loadTerms(),
    loadProjectDetails(),
  ])
}

// Persistence
watch(projectId, (newId) => {
  requestScope.invalidate()
  latestTermsRequest++
  resetProjectState()
  showLocaleReleaseDialog.value = false
  showLocalePublishConfirm.value = false
  localeRelease.value = null
  if (newId) {
    localStorage.setItem('last_project_id', newId)
    currentPage.value = 1
    clearSelectedTerms()
    refreshData()
  }
}, { flush: 'sync' })

onMounted(async () => {
  await fetchProjects()
  if (projectId.value) {
    await refreshData()
  }
  else if (projects.value.length === 0) {
    // There is no project to load, so show the normal empty state.
    loadingTerms.value = false
  }
})

const isGlobalEditing = ref(false)
const originalTermsJson = ref('')

function enterEditMode() {
  if (!can('term.edit'))
    return
  if (selectedCount.value === 0) {
    toast.info('操作提示', {
      description: '请先勾选左侧复选框，选中需要编辑的词条后再进入编辑模式。',
      action: {
        label: '知道了',
        onClick: () => {},
      },
    })
    return
  }
  if (selectionMode.value === 'all_filtered') {
    toast.info('跨页全选不支持表格内编辑', {
      description: '批量编辑会直接修改单元格，请先取消跨页全选，再逐页勾选需要编辑的词条。',
    })
    return
  }
  latestTermsRequest++
  loadingTerms.value = false
  originalTermsJson.value = captureTermDraft(terms.value, selectedTermCache.value)
  isGlobalEditing.value = true
}

const isSavingBatch = ref(false)
async function saveEditMode() {
  if (isSavingBatch.value)
    return
  if (!can('term.edit'))
    return
  const selectedTerms = selectedTermsForBulk.value

  if (selectedTerms.length === 0) {
    isGlobalEditing.value = false
    return
  }

  isSavingBatch.value = true
  try {
    const payload = selectedTerms.map(t => ({
      id: t.id,
      ...termUpdatePayload(t),
    }))

    await batchUpdateTerms(projectId.value, {

      data: { terms: payload },
    })

    toast.success('批量保存成功', { description: `已成功保存 ${payload.length} 个词条的更改。` })
    isGlobalEditing.value = false
    originalTermsJson.value = ''
    loadTerms() // 刷新最新状态
  }
  catch (error: unknown) {
    toast.error('保存失败', { description: errorMessage(error) || '网络或服务器错误' })
  }
  finally {
    isSavingBatch.value = false
  }
}

function discardEditMode() {
  if (!originalTermsJson.value)
    return
  const snapshot = restoreTermDraft(originalTermsJson.value)
  terms.value = snapshot.terms
  selectedTermCache.value = snapshot.selected
  selectedTermIds.value = Array.from(snapshot.selected.keys())
  syncSelectedTermCacheFromPage()
  originalTermsJson.value = ''
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
const publishedTermCount = computed(() => projectSummary.value.status_counts.published || 0)
const pendingTermCount = computed(() => projectSummary.value.status_counts.pending || 0)
const readyTermCount = computed(() => projectSummary.value.ready_review_count || 0)
const publishedRate = computed(() => projectSummary.value.total
  ? Math.round((publishedTermCount.value / projectSummary.value.total) * 100)
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

const paginatedTerms = computed(() => terms.value)
const pageStart = computed(() => totalTerms.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, totalTerms.value))

let termsReloadTimer: number | undefined
let suppressNextPageReload = false

function scheduleTermsReload(delay = 0, resetPage = false) {
  if (isGlobalEditing.value || stagedChangeOriginals.value.size > 0)
    return
  if (resetPage && currentPage.value !== 1) {
    suppressNextPageReload = true
    currentPage.value = 1
  }
  if (termsReloadTimer !== undefined)
    window.clearTimeout(termsReloadTimer)
  termsReloadTimer = window.setTimeout(() => loadTerms(), delay)
}

watch([searchQuery, chineseSearchQuery, englishSearchQuery], () => {
  clearSelectedTerms()
  scheduleTermsReload(300, true)
})

watch([selectedModule, selectedStatus], () => {
  clearSelectedTerms()
  scheduleTermsReload(0, true)
})

watch(pageSize, () => {
  scheduleTermsReload(0, true)
})

watch(currentPage, () => {
  if (suppressNextPageReload) {
    suppressNextPageReload = false
    return
  }
  scheduleTermsReload()
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
  { value: 'ready_review', label: '待校对', color: 'bg-muted' },
  { value: 'review', label: '待发布', color: 'bg-muted' },
  { value: 'published', label: '已发布', color: 'bg-green-500' },
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
  }, {} as Translation),
})

function addNewTerm() {
  if (!can('term.create'))
    return
  newTermForm.value = {
    module: '',
    key: '',
    description: '',
    translations: targetLanguages.value.reduce((acc, lang) => {
      acc[lang.code] = ''
      return acc
    }, {} as Translation),
  }
  showAddTermModal.value = true
}

async function submitNewTerm() {
  if (submittingTerm.value)
    return
  if (!can('term.create'))
    return
  if (!newTermForm.value.key) {
    toast.error('必须填写词条 Key')
    return
  }
  submittingTerm.value = true
  try {
    await createTerm(projectId.value, {

      data: newTermForm.value,
    })
    toast.success('词条创建成功')
    showAddTermModal.value = false
    loadTerms()
  }
  catch (e: unknown) {
    toast.error('创建失败', { description: errorMessage(e) })
  }
  finally {
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

async function translateRow(term: TermItem, customPrompt?: string): Promise<'success' | 'failed' | 'skipped'> {
  if (!can('term.translate') || translatingTerms.value.has(term.id) || term.status === 'published')
    return 'skipped'
  if (!term.key || !(Object.values(term.translations).some(text => text.trim()) || term.description?.trim())) {
    toast.error('无法翻译', { description: '请填写 Key 和至少一种参考译文或描述。' })
    return 'skipped'
  }
  const ticket = requestScope.capture()
  const original = JSON.stringify(term)
  const languages = targetLanguages.value.map(lang => lang.code)
  translatingTerms.value.add(term.id)
  try {
    const outcome = await translationService.translate(term, {
      template: customPrompt || globalPrompt.value,
      languages,
      placeholderRule: placeholderInstructionForTerm(term),
      isActive: () => ticket.isCurrent(),
    })
    if (outcome !== 'success')
      return outcome
    if (!stagedChangeOriginals.value.has(term.id))
      stagedChangeOriginals.value.set(term.id, original)
    const issues = getTermPlaceholderIssues(term)
    if (issues.length)
      toast.warning('AI 翻译完成，但占位符需要复核', { description: issues.map(item => item.lang.name).join('、') })
    return 'success'
  }
  catch (error) {
    if (ticket.isCurrent())
      toast.error('AI 翻译失败', { description: errorMessage(error) })
    return 'failed'
  }
  finally { translatingTerms.value.delete(term.id) }
}

// Track rows that have been modified locally but not yet saved (e.g. by AI)
const stagedChangeOriginals = ref(new Map<string, string>())

const persistingStaged = ref(false)
async function persistStagedRow(term: TermItem) {
  if (persistingStaged.value)
    return
  if (!can('term.translate'))
    return
  persistingStaged.value = true
  try {
    await updateTerm(projectId.value, term.id, {

      data: {
        ...termUpdatePayload(term),
      },
    })
    stagedChangeOriginals.value.delete(term.id)
    toast.success('已应用翻译', { description: '内容也已保存到数据库。' })
  }
  catch (e: unknown) {
    toast.error('保存失败', { description: errorMessage(e) })
  }
  finally { persistingStaged.value = false }
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
const selectedTermCache = ref(new Map<string, TermItem>())
const selectionMode = ref<'explicit' | 'all_filtered'>('explicit')
const excludedTermIds = ref<string[]>([])
const excludedTermCache = ref(new Map<string, TermItem>())

function syncSelectedTermCacheFromPage() {
  terms.value.forEach((term) => {
    const id = String(term.id)
    if (selectionMode.value === 'explicit' && selectedTermIds.value.includes(id)) {
      selectedTermCache.value.set(id, term)
    }
    if (selectionMode.value === 'all_filtered' && excludedTermIds.value.includes(id)) {
      excludedTermCache.value.set(id, term)
    }
  })
}

function isTermSelected(term: TermItem) {
  if (selectionMode.value === 'all_filtered') {
    return !excludedTermIds.value.includes(String(term.id))
  }
  return selectedTermIds.value.some(id => String(id) === String(term.id))
}

const selectedTermsForBulk = computed(() => {
  return Array.from(selectedTermCache.value.values())
})

const selectedCount = computed(() => selectionMode.value === 'all_filtered'
  ? Math.max(0, totalTerms.value - excludedTermIds.value.length)
  : selectedTermIds.value.length)

const selectedStatusCounts = computed<TermStatusCounts>(() => {
  const counts: TermStatusCounts = selectionMode.value === 'all_filtered'
    ? { ...filteredStatusCounts.value }
    : { draft: 0, pending: 0, review: 0, published: 0 }

  if (selectionMode.value === 'all_filtered') {
    excludedTermCache.value.forEach((term) => {
      counts[term.status] = Math.max(0, counts[term.status] - 1)
    })
  }
  else {
    selectedTermCache.value.forEach((term) => {
      counts[term.status]++
    })
  }
  return counts
})

const selectedStatusSummary = computed(() => [
  ['草稿', selectedStatusCounts.value.draft],
  ['待翻译', selectedStatusCounts.value.pending],
  ['待发布', selectedStatusCounts.value.review],
  ['已发布', selectedStatusCounts.value.published],
].filter(([, count]) => Number(count) > 0).map(([label, count]) => `${label} ${count}`).join(' · '))

async function resolveSelectedTerms() {
  if (selectionMode.value === 'explicit') {
    return Array.from(selectedTermCache.value.values())
  }
  const excluded = new Set(excludedTermIds.value)
  return (await fetchAllMatchingTerms()).filter(term => !excluded.has(String(term.id)))
}

const stagedSelectedTerms = computed(() => {
  return selectedTermsForBulk.value.filter(term => stagedChangeOriginals.value.has(term.id))
})

const stagedSelectedIds = computed(() => {
  return stagedSelectedTerms.value.map(term => String(term.id))
})

async function batchPersistStaged() {
  if (persistingStaged.value)
    return
  if (!can('term.translate'))
    return
  if (stagedSelectedTerms.value.length === 0)
    return
  persistingStaged.value = true
  let failCount = 0
  let successCount = 0

  for (const term of stagedSelectedTerms.value) {
    try {
      await updateTerm(projectId.value, term.id, {

        data: {
          ...termUpdatePayload(term),
        },
      })
      stagedChangeOriginals.value.delete(term.id)
      successCount++
    }
    catch (e) {
      failCount++
      console.error(`Failed to persist ${term.id}`, e)
    }
  }
  persistingStaged.value = false
  if (failCount)
    toast.warning('部分翻译未保存', { description: `成功 ${successCount} 条，失败 ${failCount} 条。失败项已保留，可重试。` })
  else toast.success('批量应用成功', { description: `已保存 ${successCount} 个词条的 AI 翻译。` })
}

function batchDiscardStaged() {
  if (stagedSelectedTerms.value.length === 0)
    return
  const count = stagedSelectedTerms.value.length

  stagedSelectedTerms.value.forEach((term) => {
    discardStagedRow(term)
  })
  toast.info('已批量撤销', { description: `已恢复 ${count} 个词条。` })
}

const isBatchTranslating = ref(false)
const showSettingsModal = ref(false)
const pendingBatchTranslate = ref(false) // 批量自定义提示词弹窗状态
const globalPrompt = ref(DEFAULT_TRANSLATION_PROMPT)

const isAllSelected = computed(() => {
  return paginatedTerms.value.length > 0 && paginatedTerms.value.every(term => isTermSelected(term))
})

const isIndeterminate = computed(() => {
  const selectedOnPage = paginatedTerms.value.filter(term => isTermSelected(term)).length
  return selectedOnPage > 0 && selectedOnPage < paginatedTerms.value.length
})

const checkboxAllState = computed(() => {
  if (isAllSelected.value)
    return true
  if (isIndeterminate.value)
    return 'indeterminate'
  return false
})

const isAllFilteredSelected = computed(() => {
  return selectionMode.value === 'all_filtered' && excludedTermIds.value.length === 0
})

const canSelectAllFiltered = computed(() => {
  return paginatedTerms.value.length > 0
    && totalTerms.value > paginatedTerms.value.length
    && isAllSelected.value
    && !isAllFilteredSelected.value
})

function toggleSelectTerm(id: string, checked: boolean | 'indeterminate') {
  const isChecked = checked === true
  const normalizedId = String(id)
  const term = terms.value.find(item => String(item.id) === normalizedId)
  if (selectionMode.value === 'all_filtered') {
    if (isChecked) {
      excludedTermIds.value = excludedTermIds.value.filter(item => item !== normalizedId)
      excludedTermCache.value.delete(normalizedId)
    }
    else if (!excludedTermIds.value.includes(normalizedId)) {
      excludedTermIds.value = [...excludedTermIds.value, normalizedId]
      if (term)
        excludedTermCache.value.set(normalizedId, term)
    }
    return
  }
  if (isChecked) {
    if (!selectedTermIds.value.includes(normalizedId)) {
      selectedTermIds.value = [...selectedTermIds.value, normalizedId]
      if (term)
        selectedTermCache.value.set(normalizedId, term)
    }
  }
  else {
    selectedTermIds.value = selectedTermIds.value.filter(i => i !== normalizedId)
    selectedTermCache.value.delete(normalizedId)
  }
}

function handleSelectAll(checked: boolean | 'indeterminate') {
  const isChecked = checked === true
  const pageIds = paginatedTerms.value.map(t => String(t.id))
  if (selectionMode.value === 'all_filtered') {
    if (isChecked) {
      excludedTermIds.value = excludedTermIds.value.filter(id => !pageIds.includes(id))
      pageIds.forEach(id => excludedTermCache.value.delete(id))
    }
    else {
      excludedTermIds.value = Array.from(new Set([...excludedTermIds.value, ...pageIds]))
      paginatedTerms.value.forEach(term => excludedTermCache.value.set(String(term.id), term))
    }
    return
  }
  if (isChecked) {
    selectedTermIds.value = Array.from(new Set([...selectedTermIds.value, ...pageIds]))
    paginatedTerms.value.forEach(term => selectedTermCache.value.set(String(term.id), term))
  }
  else {
    selectedTermIds.value = selectedTermIds.value.filter(id => !pageIds.includes(id))
    pageIds.forEach(id => selectedTermCache.value.delete(id))
  }
}

function selectAllFilteredTerms() {
  selectionMode.value = 'all_filtered'
  selectedTermIds.value = []
  selectedTermCache.value.clear()
  excludedTermIds.value = []
  excludedTermCache.value.clear()
  toast.success('已选择全部筛选结果', {
    description: `共 ${selectedCount.value} 条词条。`,
  })
}

function clearSelectedTerms() {
  selectionMode.value = 'explicit'
  selectedTermIds.value = []
  selectedTermCache.value.clear()
  excludedTermIds.value = []
  excludedTermCache.value.clear()
}

async function batchTranslate(customPrompt?: string) {
  if (!can('term.translate') || isBatchTranslating.value)
    return
  isBatchTranslating.value = true
  const ticket = requestScope.capture()
  const counts = { success: 0, failed: 0, skipped: 0 }
  try {
    const selected = await resolveSelectedTerms()
    for (let index = 0; index < selected.length && ticket.isCurrent(); index += 3) {
      const results = await Promise.all(selected.slice(index, index + 3).map(term => translateRow(term, customPrompt)))
      results.forEach(result => counts[result]++)
    }
    if (!ticket.isCurrent() || !selected.length)
      return
    const description = `成功 ${counts.success} 条，失败 ${counts.failed} 条，跳过 ${counts.skipped} 条。`
    if (counts.failed || counts.skipped)
      toast.warning('批量翻译完成', { description })
    else toast.success('批量翻译完成', { description })
  }
  catch (error) {
    if (ticket.isCurrent())
      toast.error('批量翻译失败', { description: errorMessage(error) })
  }
  finally { isBatchTranslating.value = false }
}

function openBatchTranslateDialog() {
  if (selectedCount.value === 0)
    return
  // 预填全局提示词（保留变量占位符，因为批量时每个词条居中注入）
  tempPrompt.value = globalPrompt.value
  pendingBatchTranslate.value = true
}

const publishableSelectedCount = computed(() => selectedStatusCounts.value.review)
const reviewableSelectedCount = computed(() => selectedStatusCounts.value.draft + selectedStatusCounts.value.pending)
const deletableSelectedCount = computed(() => selectedCount.value - selectedStatusCounts.value.published)

const bulkActionMeta: Record<BulkOperation, { title: string, verb: string, description: string, success: string }> = {
  approve_review: {
    title: '确认批量校对通过？',
    verb: '校对通过',
    description: '可执行词条将进入待发布状态。',
    success: '批量校对完成',
  },
  publish: {
    title: '确认批量发布？',
    verb: '发布',
    description: '可执行词条将立即更新线上内容。',
    success: '批量发布完成',
  },
  delete: {
    title: '确认批量删除？',
    verb: '永久删除',
    description: '可执行词条及其翻译将被永久删除，此操作不可恢复。',
    success: '批量删除完成',
  },
}

const bulkSkipReasonLabels: Record<string, string> = {
  status_not_allowed: '状态不符合要求',
  published_protected: '已发布词条受保护',
  missing_key: '缺少 Key',
  missing_translation: '缺少必填语言译文',
  placeholder_mismatch: '占位符不一致',
}

const showBulkConfirmDialog = ref(false)
const pendingBulkOperation = ref<BulkOperation | null>(null)
const pendingBulkScope = ref<TermBulkScope | null>(null)
const bulkPreview = ref<TermBulkResult | null>(null)
const isBulkPreviewing = ref(false)
const isBulkExecuting = ref(false)
const bulkActionError = ref('')
const isAnyBulkActionBusy = computed(() => isBulkPreviewing.value || isBulkExecuting.value)

const activeBulkMeta = computed(() => pendingBulkOperation.value
  ? bulkActionMeta[pendingBulkOperation.value]
  : null)

function getBulkScope(): TermBulkScope {
  if (selectionMode.value === 'all_filtered') {
    return {
      mode: 'filtered',
      filter: getTermFilterParams(),
      excluded_ids: excludedTermIds.value.map(Number),
    }
  }
  return {
    mode: 'explicit',
    ids: selectedTermIds.value.map(Number),
  }
}

function getDataScope(): TermBulkScope {
  if (selectedCount.value > 0)
    return getBulkScope()
  return {
    mode: 'filtered',
    filter: getTermFilterParams(),
    excluded_ids: [],
  }
}

function isBulkActionBusy(operation: BulkOperation) {
  return pendingBulkOperation.value === operation && (isBulkPreviewing.value || isBulkExecuting.value)
}

async function requestBulkAction(operation: BulkOperation) {
  if (!can(operation === 'delete' ? 'term.delete' : operation === 'publish' ? 'term.publish' : 'term.review'))
    return
  if (selectedCount.value === 0 || isBulkPreviewing.value || isBulkExecuting.value)
    return

  const scope = getBulkScope()
  pendingBulkOperation.value = operation
  pendingBulkScope.value = scope
  bulkPreview.value = null
  bulkActionError.value = ''
  isBulkPreviewing.value = true
  try {
    const response = await previewTermBulk<TermBulkResult>(projectId.value, {

      data: { operation, scope },
    })
    bulkPreview.value = response.data
    if (response.data.executable === 0) {
      toast.info(`没有可${bulkActionMeta[operation].verb}的词条`, {
        description: response.data.skipped > 0 ? '选中词条均未通过服务端预检查。' : '当前选择范围为空。',
      })
      return
    }
    showBulkConfirmDialog.value = true
  }
  catch (error: unknown) {
    toast.error('批量操作预检查失败', { description: errorMessage(error) })
  }
  finally {
    isBulkPreviewing.value = false
  }
}

function handleBulkDialogOpen(open: boolean) {
  if (!open && isBulkExecuting.value)
    return
  showBulkConfirmDialog.value = open
  if (!open)
    bulkActionError.value = ''
}

async function confirmBulkAction() {
  if (!pendingBulkOperation.value || !pendingBulkScope.value || isBulkExecuting.value)
    return

  const operation = pendingBulkOperation.value
  if (!can(operation === 'delete' ? 'term.delete' : operation === 'publish' ? 'term.publish' : 'term.review'))
    return
  isBulkExecuting.value = true
  bulkActionError.value = ''
  try {
    const response = await executeTermBulk<TermBulkResult>(projectId.value, {

      data: { operation, scope: pendingBulkScope.value },
    })
    const result = response.data
    showBulkConfirmDialog.value = false
    clearSelectedTerms()
    await loadTerms()
    toast.success(bulkActionMeta[operation].success, {
      description: `成功 ${result.succeeded} 条，跳过 ${result.skipped} 条。`,
    })
  }
  catch (error: unknown) {
    bulkActionError.value = errorMessage(error) || '服务端未能完成操作，请重试。'
  }
  finally {
    isBulkExecuting.value = false
  }
}

function batchApproveReview() {
  requestBulkAction('approve_review')
}

function batchDelete() {
  requestBulkAction('delete')
}

// Removed activeEditKey and startEdit/stopEdit as they are replaced by Global Edit Mode

async function deleteTerm(id: string | number) {
  if (!can('term.delete'))
    return
  try {
    await requestDeleteTerm(projectId.value, id)

    // 后端真正删除成功后，更新视图
    selectedTermIds.value = selectedTermIds.value.filter(value => value !== String(id))
    selectedTermCache.value.delete(String(id))
    stagedChangeOriginals.value.delete(String(id))
    await loadTerms()
    toast.success('删除成功')
  }
  catch (e: unknown) {
    toast.error('删除失败', { description: errorMessage(e) })
    loadTerms()
  }
}

function handleKeyUpdate(term: TermItem) {
  if (term.key && term.key.trim() !== '') {
    if (term.status === 'draft') {
      term.status = 'pending'
    }
  }
  else {
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
  if (!can('term.create'))
    return
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
  if (isBatchCreatingTerms.value)
    return
  if (!can('term.create'))
    return
  if (!projectId.value || batchCreateRows.value.length === 0 || batchRowErrors.value.size > 0)
    return

  isBatchCreatingTerms.value = true
  batchAddError.value = ''
  try {
    const res = await batchCreateTerms<BatchCreateResult>(projectId.value, {

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

    const createdIds = (res.data?.terms || []).map(item => item.term ? String(item.term.id) : '').filter(Boolean)
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
  catch (error: unknown) {
    batchAddError.value = errorMessage(error) || '批量创建失败，请检查后重试。'
  }
  finally {
    isBatchCreatingTerms.value = false
  }
}

// Focus logic removed as part of Global Edit Mode cleanup

const showExportModal = ref(false)
const selectedExportLangs = ref<string[]>([])
const isExportingJson = ref(false)
const isExportingExcel = ref(false)
const copyingLanguageCode = ref('')
const isDrawerOpen = ref(false)
const activeDrawerTerm = ref<TermItem | null>(null)
const drawerError = ref('')
const presentDeletingId = ref<string | null>(null)

function openDrawer(term: TermItem) {
  drawerError.value = ''
  // 深拷贝，防止修改立刻反应到外部表格，直到真正保存
  activeDrawerTerm.value = JSON.parse(JSON.stringify(term))
  isDrawerOpen.value = true
}

const isDrawerDirty = computed(() => {
  if (!activeDrawerTerm.value)
    return false
  const originalTerm = terms.value.find(t => Number(t.id) === Number(activeDrawerTerm.value!.id))
  return JSON.stringify(originalTerm) !== JSON.stringify(activeDrawerTerm.value)
})

const canPublishInDrawer = computed(() => {
  if (!activeDrawerTerm.value || !can('term.publish'))
    return false
  const originalTerm = terms.value.find(t => Number(t.id) === Number(activeDrawerTerm.value!.id))
  return originalTerm?.status === 'review' && !isDrawerDirty.value
})

const canApproveReviewInDrawer = computed(() => {
  if (!activeDrawerTerm.value || !can('term.review'))
    return false
  return activeDrawerTerm.value.status !== 'review' && activeDrawerTerm.value.status !== 'published'
})

const isDrawerTermPublished = computed(() => {
  if (!activeDrawerTerm.value)
    return false
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
  }
  else {
    saveDrawer()
  }
}
function confirmDrawerSave() {
  showDrawerSaveConfirmModal.value = false
  saveDrawer()
}

async function saveDrawer() {
  if (savingDrawer.value)
    return
  if (!can('term.edit'))
    return
  if (!activeDrawerTerm.value)
    return
  savingDrawer.value = true
  drawerError.value = ''
  try {
    await updateTerm(projectId.value, activeDrawerTerm.value.id, {

      data: {
        ...termUpdatePayload(activeDrawerTerm.value),
      },
    })
    toast.success('更新成功', { description: '词条详情已保存。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
    loadTerms()
  }
  catch (e: unknown) {
    drawerError.value = errorMessage(e, '更新失败')
    toast.error('保存失败', { description: errorMessage(e) })
  }
  finally {
    savingDrawer.value = false
  }
}

function getMissingTranslationLanguages(term: TermItem) {
  return targetLanguages.value.filter(lang => !term.translations[lang.code]?.trim())
}

async function approveDrawerReview() {
  if (approvingReview.value)
    return
  if (!can('term.review'))
    return
  if (!activeDrawerTerm.value)
    return

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
  drawerError.value = ''
  try {
    await updateTerm(projectId.value, activeDrawerTerm.value.id, {

      data: {
        ...termUpdatePayload(activeDrawerTerm.value),
        status: 'review',
      },
    })
    toast.success('校对通过', { description: '词条已进入待发布状态。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
    loadTerms()
  }
  catch (e: unknown) {
    drawerError.value = errorMessage(e, '校对失败')
    toast.error('校对失败', { description: errorMessage(e) })
  }
  finally {
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
  if (publishingTerm.value)
    return
  if (!can('term.publish'))
    return
  if (!activeDrawerTerm.value)
    return
  const placeholderIssues = getTermPlaceholderIssues(activeDrawerTerm.value)
  if (placeholderIssues.length > 0) {
    toast.error('占位符不一致，无法发布', {
      description: formatPlaceholderIssues(activeDrawerTerm.value),
    })
    return
  }

  publishingTerm.value = true
  drawerError.value = ''
  try {
    await requestPublishTerm(projectId.value, activeDrawerTerm.value.id)
    toast.success('已发布', { description: '词条状态已更新为已发布。' })
    isDrawerOpen.value = false
    activeDrawerTerm.value = null
    loadTerms()
  }
  catch (e: unknown) {
    drawerError.value = errorMessage(e, '发布失败')
    toast.error('发布失败', { description: errorMessage(e) })
  }
  finally {
    publishingTerm.value = false
  }
}

const translatingDrawer = ref(false)
async function translateDrawerTerm() {
  const term = activeDrawerTerm.value
  if (!can('term.translate') || !term || translatingDrawer.value)
    return
  if (!term.key || !(Object.values(term.translations).some(text => text.trim()) || term.description?.trim())) {
    toast.warning('无法翻译', { description: '请填写 Key 和至少一种参考译文或描述。' })
    return
  }
  const ticket = requestScope.capture()
  const languages = targetLanguages.value.map(lang => lang.code)
  translatingDrawer.value = true
  try {
    const outcome = await translationService.translate(term, {
      template: globalPrompt.value,
      languages,
      placeholderRule: placeholderInstructionForTerm(term),
      isActive: () => activeDrawerTerm.value === term,
    })
    if (outcome !== 'success')
      return
    const issues = getTermPlaceholderIssues(term)
    if (issues.length)
      toast.warning('AI 翻译完成，但占位符需要复核', { description: issues.map(item => item.lang.name).join('、') })
    toast.success('AI 翻译完成，尚未保存', { description: '请复核后点击保存。' })
  }
  catch (error) {
    if (ticket.isCurrent())
      toast.error('AI 翻译失败', { description: errorMessage(error) })
  }
  finally { translatingDrawer.value = false }
}

function triggerBatchPublish() {
  requestBulkAction('publish')
}

async function closeDrawer() {
  if (showDiscardDialog.value)
    return
  if (savingDrawer.value || approvingReview.value || publishingTerm.value)
    return
  if (isDrawerDirty.value && !(await confirmDiscard()))
    return
  isDrawerOpen.value = false
  activeDrawerTerm.value = null
}

const { bindExcelFileInput, bindJsonFileInput, importingExcel, excelImportStage, triggerExcelImport, triggerJsonImport, importingJson, showObjectImportModal, objectImportText, objectImportLangCode, importingObjectJson, openObjectImportModal, submitObjectImport, handleJsonImport, handleExcelImport } = useTermImport({ projectId, targetLanguages, availableLanguages, sourceLanguageCode, terms, can, loadTerms, BATCH_CREATE_LIMIT })

// Side drawer functions already defined above

// Default exclusions: 'tr' (土耳其语), 'bn' (孟加拉语), 'pl' (波兰语), 'it' (意大利语)
const defaultExcludedLangs = ['tr', 'bn', 'pl', 'it']

async function copyLangJson(langCode: string, langName: string) {
  if (!can('term.export'))
    return
  if (copyingLanguageCode.value)
    return
  copyingLanguageCode.value = langCode
  try {
    const response = await copyTermExport<{ content: string, count: number }>(projectId.value, {

      data: {
        scope: getDataScope(),
        language: langCode,
      },
    })
    const jsonStr = response.data.content

    // Fallback for non-HTTPS (like local network IP) where navigator.clipboard is undefined
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(jsonStr)
    }
    else {
      const textArea = document.createElement('textarea')
      textArea.value = jsonStr
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (!successful)
        throw new Error('Fallback copy command failed')
    }

    toast.success('复制成功', {
      description: `已复制【${langName}】的 ${response.data.count} 条词条 JSON。`,
    })
  }
  catch (error: unknown) {
    toast.error('复制失败', {
      description: errorMessage(error) || '写入剪贴板失败，请检查浏览器权限。',
    })
  }
  finally {
    copyingLanguageCode.value = ''
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

function getJsonArchiveName() {
  const projectName = String(currentProject.value?.name || 'translations')
    .trim()
    // File names cannot contain control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[.\s]+$/g, '')
    .slice(0, 80) || 'translations'
  const date = new Date().toISOString().slice(0, 10)
  return `${projectName}_locales_${date}.zip`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function confirmExport() {
  if (!can('term.export'))
    return
  if (selectedExportLangs.value.length === 0) {
    toast.warning('导出提醒', { description: '请至少选择一种语言导出！' })
    return
  }

  isExportingJson.value = true
  try {
    const result = await downloadTermsJson(projectId.value, {

      data: {
        scope: getDataScope(),
        languages: selectedExportLangs.value,
      },
    })
    downloadBlob(result.blob, getJsonArchiveName())

    toast.success('导出成功', {
      description: `已由服务端生成 ${selectedExportLangs.value.length} 个语言的 JSON 压缩包。`,
    })
    closeExportModal()
  }
  catch (error: unknown) {
    console.error('Export JSON ZIP Error:', error)
    toast.error('导出失败', { description: errorMessage(error, 'ZIP 文件生成失败，请重试。') })
  }
  finally {
    isExportingJson.value = false
  }
}

async function exportToExcel() {
  if (!can('term.export'))
    return
  if (isExportingExcel.value)
    return
  isExportingExcel.value = true
  try {
    const result = await downloadTermsExcel(projectId.value, {

      data: { scope: getDataScope() },
    })
    downloadBlob(result.blob, `translations_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('导出成功', { description: 'Excel 文件已由服务端生成。' })
  }
  catch (error: unknown) {
    toast.error('导出失败', { description: errorMessage(error) || 'Excel 文件生成失败。' })
  }
  finally {
    isExportingExcel.value = false
  }
}

const hasUnsavedChanges = computed(() => isDrawerDirty.value || isGlobalEditing.value || stagedChangeOriginals.value.size > 0)
const { showDiscardDialog, confirmDiscard, resolveDiscard } = useDiscardConfirmation(() => hasUnsavedChanges.value)
const operationInProgress = computed(() => isSavingBatch.value || savingDrawer.value || approvingReview.value || publishingTerm.value
  || isBatchTranslating.value || translatingTerms.value.size > 0 || translatingDrawer.value || submittingTerm.value
  || isBulkExecuting.value || isBulkPreviewing.value || importingExcel.value || importingJson.value || importingObjectJson.value
  || isBatchCreatingTerms.value || isSavingPrompt.value || publishingLocaleRelease.value || isExportingJson.value || isExportingExcel.value || persistingStaged.value)
async function canLeaveWorkbench() {
  if (operationInProgress.value) {
    toast.info('操作正在进行', { description: '请等待当前操作完成后再切换项目或页面。' })
    return false
  }
  return confirmDiscard()
}
onBeforeRouteLeave(canLeaveWorkbench)
onBeforeRouteUpdate(async (to, from) => to.query.project === from.query.project || await canLeaveWorkbench())
onScopeDispose(() => window.clearTimeout(termsReloadTimer))
function resetProjectState() {
  window.clearTimeout(termsReloadTimer)
  terms.value = []
  targetLanguages.value = []
  globalPrompt.value = DEFAULT_TRANSLATION_PROMPT
  clearSelectedTerms()
  stagedChangeOriginals.value.clear()
  isGlobalEditing.value = false
  originalTermsJson.value = ''
  activeDrawerTerm.value = null
  isDrawerOpen.value = false
  showDrawerSaveConfirmModal.value = false
  showDrawerPublishConfirmModal.value = false
  showSettingsModal.value = false
  pendingBatchTranslate.value = false
  showBulkConfirmDialog.value = false
  pendingBulkOperation.value = null
  pendingBulkScope.value = null
  bulkPreview.value = null
  showAddTermModal.value = false
  showBatchAddModal.value = false
  showObjectImportModal.value = false
  showExportModal.value = false
  totalTerms.value = 0
  totalPages.value = 1
  modules.value = []
}
</script>

<template>
  <div class="workspace-page flex min-h-[calc(100svh-3rem)] md:min-h-svh min-w-0 flex-col gap-5">
    <header class="shrink-0 space-y-5">
      <div class="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div class="flex min-w-0 flex-wrap gap-3 sm:items-center">
          <div class="shrink-0">
            <h1 class="text-2xl font-semibold tracking-tight text-foreground">
              词条工作台
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              管理当前项目的词条、译文与发布流程
            </p>
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
              <UiDropdownMenuLabel class="text-xs text-muted-foreground">
                切换当前工作项目
              </UiDropdownMenuLabel>
              <UiDropdownMenuSeparator />
              <UiDropdownMenuItem
                v-for="p in projects" :key="p.id"
                class="flex items-center justify-between"
                :class="String(p.id) === projectId && 'bg-primary/10 text-primary font-medium'"
                @click="router.push({ query: { ...route.query, project: p.id } })"
              >
                {{ p.name }}
                <CheckCircle2 v-if="String(p.id) === projectId" class="w-3 h-3" />
              </UiDropdownMenuItem>
            </UiDropdownMenuContent>
          </UiDropdownMenu>

          <div class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
            <span class="font-medium text-foreground">{{ targetLanguages.find(lang => lang.code === sourceLanguageCode)?.name || '源语言' }}</span>
            <span class="text-primary">→</span>
            <span class="truncate text-muted-foreground">{{ Math.max(targetLanguages.length - 1, 0) }} 个目标语种</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 xl:justify-end">
          <input
            :ref="bindExcelFileInput"
            type="file"
            accept=".xlsx, .xls, .csv"
            class="hidden"
            @change="handleExcelImport"
          >
          <input
            :ref="bindJsonFileInput"
            type="file"
            accept=".json"
            multiple
            class="hidden"
            @change="handleJsonImport"
          >
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
              <template v-if="can(['term.import', 'term.export'])">
                <UiDropdownMenuLabel v-if="can('term.import')" class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                  批量录入
                </UiDropdownMenuLabel>
                <UiDropdownMenuItem v-permission="'term.import'" class="items-start gap-3 px-2 py-2.5" :disabled="importingJson || isGlobalEditing" @click="triggerJsonImport">
                  <Loader2 v-if="importingJson" class="mt-0.5 size-4 shrink-0 animate-spin" />
                  <Upload v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{ importingJson ? '正在导入 JSON' : '导入多语言 JSON' }}</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">一次选择多个语言文件并合并词条</span>
                  </span>
                </UiDropdownMenuItem>
                <UiDropdownMenuItem v-permission="'term.import'" class="items-start gap-3 px-2 py-2.5" :disabled="importingObjectJson || isGlobalEditing" @click="openObjectImportModal">
                  <Loader2 v-if="importingObjectJson" class="mt-0.5 size-4 shrink-0 animate-spin" />
                  <Copy v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">粘贴对象</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">粘贴代码对象并导入指定语言</span>
                  </span>
                </UiDropdownMenuItem>
                <UiDropdownMenuItem v-permission="'term.import'" class="items-start gap-3 px-2 py-2.5" :disabled="isGlobalEditing || importingExcel" @click="triggerExcelImport">
                  <Loader2 v-if="importingExcel" class="mt-0.5 size-4 shrink-0 animate-spin" />
                  <Upload v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{ importingExcel ? '正在导入 Excel' : '导入 Excel' }}</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">从表格批量创建词条和译文</span>
                  </span>
                </UiDropdownMenuItem>
                <UiDropdownMenuSeparator v-if="can('term.import')" />
                <UiDropdownMenuLabel v-if="can('term.export')" class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                  数据导出
                </UiDropdownMenuLabel>
                <UiDropdownMenuItem v-permission="'term.export'" class="items-start gap-3 px-2 py-2.5" @click="openExportModal">
                  <Download class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">导出多语言 JSON</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">按语言生成文件并打包为 ZIP</span>
                  </span>
                </UiDropdownMenuItem>
                <UiDropdownMenuItem v-permission="'term.export'" :disabled="isExportingExcel" class="items-start gap-3 px-2 py-2.5" @click="exportToExcel">
                  <Loader2 v-if="isExportingExcel" class="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                  <Download v-else class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">导出为 Excel</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">导出筛选结果或当前选中词条</span>
                  </span>
                </UiDropdownMenuItem>
              </template>
              <UiDropdownMenuSeparator v-if="can('term.import')" />
              <UiDropdownMenuItem class="items-start gap-3 px-2 py-2.5" @click="openLocaleReleaseDialog">
                <Download class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">线上语言文件</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">查看公开链接与手动发布的版本</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuSeparator />
              <UiDropdownMenuLabel class="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                词条与项目
              </UiDropdownMenuLabel>
              <UiDropdownMenuItem v-permission="'term.create'" class="items-start gap-3 px-2 py-2.5" :disabled="isGlobalEditing" @click="openBatchAddDialog">
                <ListPlus class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">快捷批量创建</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">粘贴多行原文，预览后统一创建</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuItem
                v-permission="'logs.view'"
                class="items-start gap-3 px-2 py-2.5"
                @click="router.push({ path: '/project-logs', query: { project: projectId } })"
              >
                <Activity class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium">操作日志</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">查看项目内词条的变更记录</span>
                </span>
              </UiDropdownMenuItem>
              <UiDropdownMenuItem v-permission="'project.prompt'" class="items-start gap-3 px-2 py-2.5" @click="showSettingsModal = true">
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
            v-permission="'term.edit'"
            variant="secondary"
            class="rounded-xl border-primary/20 text-primary hover:bg-primary/5"
            @click="enterEditMode"
          >
            <Edit3 class="w-4 h-4 mr-2" />
            进入编辑模式
          </UiButton>

          <div v-else class="flex gap-1 rounded-xl border border-primary/20 bg-primary/[0.07] p-1 animate-in fade-in duration-200">
            <UiButton
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-destructive"
              @click="discardEditMode"
            >
              <RotateCcw class="w-4 h-4 mr-2" />
              放弃
            </UiButton>
            <UiButton
              v-permission="'term.edit'"
              variant="default"
              size="sm"
              :disabled="isSavingBatch"
              class="shadow-sm"
              @click="saveEditMode"
            >
              <Loader2 v-if="isSavingBatch" class="w-4 h-4 mr-2 animate-spin" />
              <Save v-else class="w-4 h-4 mr-2" />
              保存全部
            </UiButton>
          </div>

          <UiButton
            v-permission="'term.create'"
            variant="default"
            :disabled="isGlobalEditing"
            class="rounded-xl"
            @click="addNewTerm"
          >
            <Plus class="w-4 h-4 mr-2" />
            新建词条
          </UiButton>
        </div>
      </div>

      <div class="metric-strip text-xs">
        <div data-tone="info" class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">词条总量</span><strong class="text-xl font-semibold tabular-nums">{{ projectSummary.total }}</strong>
        </div>
        <div data-tone="warning" class="flex items-center justify-between gap-3">
          <span class="detail-text">待补译</span><strong class="text-xl font-semibold tabular-nums">{{ pendingTermCount }}</strong>
        </div>
        <div data-tone="violet" class="flex items-center justify-between gap-3">
          <span class="detail-text">可校对</span><strong class="text-xl font-semibold tabular-nums">{{ readyTermCount }}</strong>
        </div>
        <div data-tone="success" class="flex items-center gap-3">
          <span class="detail-text shrink-0">已发布</span><div class="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
            <div class="detail-progress h-full rounded-full" :style="{ width: `${publishedRate}%` }" />
          </div><strong class="text-xl font-semibold tabular-nums">{{ publishedRate }}%</strong>
        </div>
      </div>
    </header>

    <!-- 顶栏过滤器和批量操作栏 -->
    <section aria-label="词条筛选与批量操作" class="shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div class="grid gap-3 p-3 lg:grid-cols-12 lg:p-4">
        <div class="relative lg:col-span-4">
          <label for="term-search" class="sr-only">搜索 Key 或模块</label>
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <UiInput
            id="term-search"
            v-model="searchQuery" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0"
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
            v-model="chineseSearchQuery" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0"
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
            v-model="englishSearchQuery" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0"
            placeholder="英文译文"
            class="h-10 rounded-xl bg-background pr-9"
          />
          <button v-if="englishSearchQuery" type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="清除英文搜索" @click="clearSearchField('en')">
            <X class="size-3.5" />
          </button>
        </div>

        <UiSelect v-model="selectedModule" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0" class="lg:col-span-2">
          <UiSelectTrigger aria-label="按模块筛选" class="h-10 w-full rounded-xl bg-background lg:col-span-2">
            <UiSelectValue placeholder="选择模块" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="all">
              所有模块
            </UiSelectItem>
            <UiSelectItem v-for="mod in modules" :key="mod" :value="mod === '' ? '__none__' : mod">
              {{ mod === '' ? '(无模块)' : mod }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>

        <UiSelect v-model="selectedStatus" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0">
          <UiSelectTrigger aria-label="按状态筛选" class="h-10 w-full rounded-xl bg-background lg:col-span-2">
            <UiSelectValue placeholder="选择状态" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="all">
              所有状态
            </UiSelectItem>
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
            <span v-if="selectedStatusSummary" class="ml-2 text-xs text-muted-foreground">{{ selectedStatusSummary }}</span>
          </section>

          <UiSeparator class="h-5 mx-1" orientation="vertical" />

          <div class="flex items-center gap-x-2 whitespace-nowrap">
            <!-- Split Batch Translate Button: Developer cannot self-translate -->
            <div v-permission="'term.translate'" class="inline-flex items-center rounded-md shadow-sm">
              <UiButton v-permission="'term.translate'" variant="default" size="sm" :disabled="isBatchTranslating" class="rounded-r-none" @click="batchTranslate()">
                <Loader2 v-if="isBatchTranslating" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <Wand2 v-else class="w-3.5 h-3.5 mr-1.5" />
                AI 批量翻译
              </UiButton>
              <UiTooltipProvider>
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <UiButton v-permission="'term.translate'" variant="default" size="sm" :disabled="isBatchTranslating" class="rounded-l-none border-l border-primary-foreground/20 px-1.5" @click="openBatchTranslateDialog">
                      <ChevronDown class="w-3.5 h-3.5" />
                    </UiButton>
                  </UiTooltipTrigger>
                  <UiTooltipContent>自定义提示词批量翻译</UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </div>

            <template v-if="stagedSelectedIds.length > 0">
              <UiButton
                v-permission="'term.translate'"
                variant="outline"
                size="sm"
                class="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                @click="batchPersistStaged"
              >
                <CheckCircle2 class="w-3.5 h-3.5 mr-1.5" />
                采纳 AI 建议 ({{ stagedSelectedIds.length }})
              </UiButton>
              <UiButton
                variant="outline"
                size="sm"
                class="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                @click="batchDiscardStaged"
              >
                <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
                舍弃 AI 建议
              </UiButton>
              <UiSeparator class="h-5 mx-1" orientation="vertical" />
            </template>

            <UiButton
              v-permission="'term.review'"
              variant="outline"
              size="sm"
              :disabled="isAnyBulkActionBusy || reviewableSelectedCount === 0"
              class="border-border text-foreground hover:bg-muted dark:hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              @click="batchApproveReview"
            >
              <Loader2 v-if="isBulkActionBusy('approve_review')" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <CheckCircle2 v-else class="w-3.5 h-3.5 mr-1.5" />
              批量校对通过 {{ reviewableSelectedCount > 0 ? `(${reviewableSelectedCount})` : '' }}
            </UiButton>

            <UiButton
              v-permission="'term.publish'"
              variant="outline"
              size="sm"
              :disabled="isAnyBulkActionBusy || publishableSelectedCount === 0"
              class="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="triggerBatchPublish"
            >
              <Loader2 v-if="isBulkActionBusy('publish')" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <CheckCircle2 v-else class="w-3.5 h-3.5 mr-1.5" />
              批量发布 {{ publishableSelectedCount > 0 ? `(${publishableSelectedCount})` : '' }}
            </UiButton>

            <UiButton v-permission="'term.delete'" variant="destructive" size="sm" :disabled="isAnyBulkActionBusy || deletableSelectedCount === 0" @click="batchDelete">
              <Loader2 v-if="isBulkActionBusy('delete')" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <Trash2 v-else class="w-3.5 h-3.5 mr-1.5" />
              批量删除
            </UiButton>
          </div>
        </div>
        <div v-else class="flex min-h-[52px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted-foreground">
          <div class="flex items-center gap-2">
            <span class="size-1.5 rounded-full bg-primary/60" />
            <span v-if="hasActiveFilters">筛选后显示 {{ totalTerms }} / {{ projectSummary.total }} 条词条</span>
            <span v-else>勾选词条后可进行批量翻译、校对、发布或删除</span>
          </div>
          <UiButton v-if="hasActiveFilters" variant="ghost" size="sm" class="h-7 px-2 text-xs" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0" @click="clearAllFilters">
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
        <UiButton variant="link" size="sm" class="h-auto px-1 py-0 !text-foreground font-medium underline decoration-indigo-400/70 underline-offset-4 hover:!text-foreground hover:decoration-indigo-600 dark:!text-foreground dark:hover:!text-foreground" @click="selectAllFilteredTerms">
          选择符合当前筛选条件的全部 {{ totalTerms }} 条
        </UiButton>
      </div>
      <div
        v-else-if="selectionMode === 'all_filtered'"
        class="flex flex-wrap items-center justify-center gap-2 border-t border-primary/15 bg-primary/[0.04] px-3 py-2 text-sm text-muted-foreground"
      >
        <span>
          已选择符合当前筛选条件的全部 {{ selectedCount }} 条
          <template v-if="excludedTermIds.length > 0">（已排除 {{ excludedTermIds.length }} 条）</template>。
        </span>
        <UiButton variant="link" size="sm" class="h-auto px-1 py-0 !text-foreground font-medium underline decoration-indigo-400/70 underline-offset-4 hover:!text-foreground hover:decoration-indigo-600 dark:!text-foreground dark:hover:!text-foreground" @click="clearSelectedTerms">
          取消跨页全选
        </UiButton>
      </div>
    </section>

    <!-- 词条表格 -->
    <section aria-label="词条列表" class="translation-table relative flex h-[clamp(480px,66svh,900px)] min-h-[480px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div class="min-h-0 flex-1 overflow-hidden">
        <UiTable class="relative min-w-max">
          <UiTableCaption class="sr-only">
            当前项目的多语言词条、流程状态与更新时间
          </UiTableCaption>
          <UiTableHeader class="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/80">
            <UiTableRow class="hover:bg-transparent">
              <UiTableHead class="w-10 px-3 text-center xl:sticky xl:left-0 xl:z-30 xl:bg-muted/95">
                <UiCheckbox
                  :model-value="checkboxAllState"
                  aria-label="选择当前页全部词条"
                  @update:model-value="handleSelectAll"
                />
              </UiTableHead>
              <UiTableHead class="w-24 text-center xl:sticky xl:left-10 xl:z-30 xl:bg-muted/95">
                操作
              </UiTableHead>
              <UiTableHead class="min-w-[220px] border-r border-border/70 xl:sticky xl:left-[136px] xl:z-30 xl:bg-muted/95">
                词条标识与说明
              </UiTableHead>
              <UiTableHead class="w-28 text-center">
                状态
              </UiTableHead>
              <UiTableHead v-for="lang in targetLanguages" :key="lang.code" class="min-w-[220px] py-2">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-foreground/80">{{ lang.name }}</span>
                  <span class="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ lang.code }}</span>
                  <span v-if="lang.code === sourceLanguageCode" class="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">源</span>
                </div>
              </UiTableHead>
              <UiTableHead class="w-36 text-muted-foreground">
                创建时间
              </UiTableHead>
              <UiTableHead class="w-36 text-muted-foreground">
                更新时间
              </UiTableHead>
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
                'bg-muted dark:bg-muted': recentlyCreatedTermIds.includes(String(term.id)),
              }"
            >
              <!-- 多选列 -->
              <UiTableCell class="w-10 bg-card px-3 py-3 text-center align-top transition-colors group-hover:bg-muted/35 xl:sticky xl:left-0 xl:z-10">
                <UiCheckbox
                  :model-value="isTermSelected(term)"
                  :aria-label="`选择词条 ${term.key || term.id}`"
                  @update:model-value="toggleSelectTerm(term.id, $event)"
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
                            class="size-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                            :aria-label="`接受并保存词条 ${term.key}`"
                            @click="persistStagedRow(term)"
                          >
                            <CheckCircle2 class="w-3.5 h-3.5" />
                          </UiButton>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top">
                          接受并保存
                        </UiTooltipContent>
                      </UiTooltip>

                      <UiTooltip>
                        <UiTooltipTrigger as-child>
                          <UiButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            class="size-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            :aria-label="`撤销词条 ${term.key} 的翻译`"
                            @click="discardStagedRow(term)"
                          >
                            <RotateCcw class="w-3.5 h-3.5" />
                          </UiButton>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top">
                          撤销翻译
                        </UiTooltipContent>
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
                            class="size-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            :aria-label="`打开词条 ${term.key} 的详情`"
                            @click="openDrawer(term)"
                          >
                            <Edit3 class="w-3.5 h-3.5" />
                          </UiButton>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top">
                          配置详情
                        </UiTooltipContent>
                      </UiTooltip>

                      <!-- Translate Button: Developer cannot self-translate -->
                      <UiTooltip v-if="term.status !== 'published' && can('term.translate')">
                        <UiTooltipTrigger as-child>
                          <UiButton
                            v-permission="'term.translate'"
                            type="button"
                            variant="ghost"
                            size="icon"
                            :disabled="translatingTerms.has(term.id)"
                            class="size-8 text-primary/70 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                            :aria-label="translatingTerms.has(term.id) ? `正在翻译词条 ${term.key}` : `AI 翻译词条 ${term.key}`"
                            @click="translateRow(term)"
                          >
                            <Loader2 v-if="translatingTerms.has(term.id)" class="w-3.5 h-3.5 animate-spin" />
                            <Wand2 v-else class="w-3.5 h-3.5" />
                          </UiButton>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top">
                          AI 翻译
                        </UiTooltipContent>
                      </UiTooltip>
                      <UiTooltip v-else>
                        <UiTooltipTrigger as-child>
                          <UiButton type="button" variant="ghost" size="icon" disabled class="size-8 text-muted-foreground/40" aria-label="当前不可使用 AI 翻译">
                            <Wand2 class="w-3.5 h-3.5" />
                          </UiButton>
                        </UiTooltipTrigger>
                        <UiTooltipContent side="top">
                          请通过配置详情进行更新
                        </UiTooltipContent>
                      </UiTooltip>

                      <UiAlertDialog v-if="term.status !== 'published' && can('term.delete')" @update:open="val => presentDeletingId = val ? term.id : null">
                        <UiTooltip :open="presentDeletingId === term.id ? false : undefined">
                          <UiTooltipTrigger v-if="can('term.delete')" as-child>
                            <UiAlertDialogTrigger as-child>
                              <UiButton type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" :aria-label="`删除词条 ${term.key}`">
                                <Trash2 class="w-3.5 h-3.5" />
                              </UiButton>
                            </UiAlertDialogTrigger>
                          </UiTooltipTrigger>
                          <UiTooltipTrigger v-else as-child>
                            <UiButton type="button" variant="ghost" size="icon" disabled class="size-8 text-muted-foreground/30" aria-label="无权删除词条">
                              <Trash2 class="w-3.5 h-3.5" />
                            </UiButton>
                          </UiTooltipTrigger>
                          <UiTooltipContent side="top">
                            {{ can('term.delete') ? '删除词条' : '无权删除' }}
                          </UiTooltipContent>
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
                            <UiAlertDialogAction v-permission="'term.delete'" class="bg-destructive text-white hover:bg-destructive/90" @click="deleteTerm(term.id)">
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
                        <UiTooltipContent side="top">
                          {{ term.status === 'published' ? '不可删除线上已发布项' : '无权限操作' }}
                        </UiTooltipContent>
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
                          :disabled="!can('term.structure')"
                          class="h-6 w-16 text-[10px] font-mono text-primary bg-background border-primary/20 shrink-0 px-1"
                          placeholder="模块"
                        />
                        <UiInput
                          v-model="term.key"
                          :disabled="!can('term.structure')"
                          class="h-6 flex-1 text-xs font-bold border-b border-t-0 border-l-0 border-r-0 border-primary/30 focus-visible:ring-0 px-1 py-0 shadow-none rounded-none placeholder:text-red-400 bg-transparent"
                          placeholder="Key不可为空"
                          @update:model-value="handleKeyUpdate(term)"
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
                        :disabled="!can('term.description')"
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
                      term.status === 'draft' ? 'bg-muted text-foreground border-border'
                      : term.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : term.status === 'review' ? 'bg-muted text-foreground border-border'
                          : 'bg-muted text-foreground border-border',
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
                      :disabled="!can('term.translate')"
                      class="w-full min-h-[44px] p-1.5 text-xs shadow-none bg-background border-primary/20 focus-visible:ring-1 focus-visible:ring-primary/20 resize-none transition-all leading-relaxed"
                      :class="hasTranslationPlaceholderMismatch(term, lang.code) ? 'border-destructive focus-visible:ring-destructive/30' : ''"
                      :placeholder="`输入 ${lang.name}...`"
                      @update:model-value="handleTranslationUpdate(term)"
                    />
                  </template>
                  <template v-else>
                    <div
                      class="w-full min-h-[44px] p-1.5 text-xs break-words whitespace-pre-wrap rounded border border-transparent transition-colors group-hover/cell:bg-muted/60"
                      :class="[
                        !term.translations[lang.code] ? 'text-muted-foreground/55' : 'text-foreground/80',
                        hasTranslationPlaceholderMismatch(term, lang.code) ? 'border-destructive/40 bg-destructive/5 text-destructive dark:text-destructive' : '',
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
            <UiTableRow v-if="totalTerms === 0 && !loadingTerms">
              <UiTableCell :colspan="targetLanguages.length + 6" class="h-[400px] text-center p-0 border-none hover:bg-transparent">
                <div class="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                  <div class="flex size-14 items-center justify-center rounded-xl border border-dashed bg-muted/40">
                    <Search class="size-6 opacity-40" />
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm font-medium text-foreground">
                      {{ projectSummary.total === 0 ? '当前项目还没有词条' : '没有匹配的词条' }}
                    </p>
                    <p class="text-xs opacity-70">
                      {{ projectSummary.total === 0 ? '创建第一条词条，开始建立多语言内容。' : '调整关键词、模块或状态筛选后再试。' }}
                    </p>
                  </div>
                  <UiButton v-if="projectSummary.total === 0" v-permission="'term.create'" variant="outline" size="sm" class="mt-2" @click="showAddTermModal = true">
                    <Plus class="size-3.5 mr-1.5" />
                    新建词条
                  </UiButton>
                  <UiButton v-else-if="hasActiveFilters" variant="outline" size="sm" class="mt-2" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0" @click="clearAllFilters">
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
          共 {{ totalTerms }} 条
          <template v-if="totalTerms > 0">
            ，当前 {{ pageStart }}-{{ pageEnd }} 条
          </template>
          <template v-if="selectedCount > 0">
            ，已选 {{ selectedCount }} 条
          </template>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">每页</span>
            <UiSelect :disabled="isGlobalEditing || stagedChangeOriginals.size > 0" :model-value="String(pageSize)" @update:model-value="value => pageSize = Number(value)">
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
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="第一页" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0 || currentPage === 1" @click="goToFirstPage">
              <ChevronsLeft class="h-4 w-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="上一页" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0 || currentPage === 1" @click="goToPreviousPage">
              <ChevronLeft class="h-4 w-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="下一页" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0 || currentPage === totalPages" @click="goToNextPage">
              <ChevronRight class="h-4 w-4" />
            </UiButton>
            <UiButton variant="outline" size="icon" class="h-8 w-8" aria-label="最后一页" :disabled="isGlobalEditing || stagedChangeOriginals.size > 0 || currentPage === totalPages" @click="goToLastPage">
              <ChevronsRight class="h-4 w-4" />
            </UiButton>
          </div>
        </div>
      </div>

      <!-- 绝对定位的 Empty / Loading 覆盖层，始终在视口水平居中，无视表格向右滚动 -->
      <div v-if="loadingTerms" class="absolute inset-0 top-[40px] z-20 flex items-center justify-center bg-card/75 backdrop-blur-[1px]" role="status" aria-live="polite">
        <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/80 bg-card p-6 text-muted-foreground shadow-lg">
          <Loader2 class="size-8 animate-spin text-primary" />
          <p class="text-sm font-medium">
            正在加载词条数据...
          </p>
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
              <UiLabel for="batch-source-language">
                原文语言
              </UiLabel>
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
              <UiLabel for="batch-default-module">
                默认模块（可选）
              </UiLabel>
              <UiInput id="batch-default-module" v-model="batchDefaultModule" maxlength="100" placeholder="例如：common、auth" />
            </div>
          </div>

          <div class="space-y-2">
            <UiLabel for="batch-create-content">
              粘贴清单，一行一条
            </UiLabel>
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
                  <UiTableHead class="w-12 text-center">
                    #
                  </UiTableHead>
                  <UiTableHead class="min-w-[220px]">
                    Key
                  </UiTableHead>
                  <UiTableHead class="min-w-[150px]">
                    模块
                  </UiTableHead>
                  <UiTableHead class="min-w-[260px]">
                    {{ targetLanguages.find(lang => lang.code === batchSourceLangCode)?.name || '原文' }}
                  </UiTableHead>
                  <UiTableHead class="min-w-[200px]">
                    描述（可选）
                  </UiTableHead>
                  <UiTableHead class="min-w-[200px]">
                    检查结果
                  </UiTableHead>
                  <UiTableHead class="w-16">
                    <span class="sr-only">操作</span>
                  </UiTableHead>
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                <UiTableRow v-for="(row, index) in batchCreateRows" :key="row.clientId">
                  <UiTableCell class="text-center text-xs text-muted-foreground">
                    {{ index + 1 }}
                  </UiTableCell>
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
                    <span v-else class="text-xs text-foreground dark:text-foreground">可以创建</span>
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
            <UiButton variant="outline" :disabled="isBatchCreatingTerms" @click="handleBatchAddOpenChange(false)">
              取消
            </UiButton>
            <UiButton :disabled="!batchAddText.trim() || !batchSourceLangCode" @click="confirmBatchAdd">
              下一步：预览
            </UiButton>
          </template>
          <template v-else>
            <UiButton variant="outline" :disabled="isBatchCreatingTerms" @click="batchAddStep = 'input'">
              返回修改
            </UiButton>
            <UiButton
              v-permission="'term.create'"
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

    <TermEditorSheet
      v-model:term="activeDrawerTerm" :open="isDrawerOpen" :languages="targetLanguages"
      :published="isDrawerTermPublished" :dirty="isDrawerDirty" :can-review="canApproveReviewInDrawer" :can-publish="canPublishInDrawer"
      :confirming="showDiscardDialog" :error="drawerError" :saving="savingDrawer" :reviewing="approvingReview" :publishing="publishingTerm" :translating="translatingDrawer"
      :can="can" :placeholder-diff="getTranslationPlaceholderDiff"
      @close="closeDrawer" @key-update="handleKeyUpdate" @translation-update="handleTranslationUpdate"
      @translate="translateDrawerTerm" @review="approveDrawerReview" @save="triggerDrawerSave" @publish="triggerDrawerPublish"
    />
    <UiAlertDialog :open="showDiscardDialog" @update:open="open => { if (!open) resolveDiscard(false) }">
      <UiAlertDialogContent class="z-[100]">
        <UiAlertDialogHeader><UiAlertDialogTitle>放弃未保存的修改？</UiAlertDialogTitle><UiAlertDialogDescription>当前草稿或 AI 翻译尚未保存。放弃后无法恢复。</UiAlertDialogDescription></UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel @click="resolveDiscard(false)">
            继续编辑
          </UiAlertDialogCancel><UiButton variant="destructive" @click="resolveDiscard(true)">
            放弃修改
          </UiButton>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
    <!-- 服务端预检查后的统一批量操作确认 -->
    <UiAlertDialog :open="showBulkConfirmDialog" @update:open="handleBulkDialogOpen">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>{{ activeBulkMeta?.title }}</UiAlertDialogTitle>
          <UiAlertDialogDescription>{{ activeBulkMeta?.description }}</UiAlertDialogDescription>
        </UiAlertDialogHeader>

        <div v-if="bulkPreview" class="space-y-3 py-1">
          <div class="grid grid-cols-3 gap-2" aria-label="批量操作预检查结果">
            <div class="rounded-lg border bg-muted/40 px-3 py-2">
              <p class="text-[11px] text-muted-foreground">
                选中范围
              </p>
              <p class="mt-0.5 font-mono text-lg font-semibold">
                {{ bulkPreview.matched }}
              </p>
            </div>
            <div class="rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2">
              <p class="text-[11px] text-muted-foreground">
                本次执行
              </p>
              <p class="mt-0.5 font-mono text-lg font-semibold text-primary">
                {{ bulkPreview.executable }}
              </p>
            </div>
            <div class="rounded-lg border bg-muted/40 px-3 py-2">
              <p class="text-[11px] text-muted-foreground">
                自动跳过
              </p>
              <p class="mt-0.5 font-mono text-lg font-semibold">
                {{ bulkPreview.skipped }}
              </p>
            </div>
          </div>

          <div v-if="bulkPreview.skipped > 0" class="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-sm">
            <p class="font-medium text-foreground">
              跳过原因
            </p>
            <ul class="mt-1.5 space-y-1 text-muted-foreground">
              <li v-for="(count, reason) in bulkPreview.skip_reasons" :key="reason" class="flex justify-between gap-4">
                <span>{{ bulkSkipReasonLabels[reason] || reason }}</span>
                <span class="font-mono text-foreground">{{ count }}</span>
              </li>
            </ul>
          </div>

          <div v-if="bulkActionError" role="alert" class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {{ bulkActionError }}
          </div>
        </div>

        <UiAlertDialogFooter>
          <UiAlertDialogCancel :disabled="isBulkExecuting">
            取消
          </UiAlertDialogCancel>
          <UiButton
            :variant="pendingBulkOperation === 'delete' ? 'destructive' : 'default'"
            :disabled="isBulkExecuting || !bulkPreview?.executable"
            @click="confirmBulkAction"
          >
            <Loader2 v-if="isBulkExecuting" class="mr-2 size-4 animate-spin" />
            {{ activeBulkMeta?.verb }} {{ bulkPreview?.executable || 0 }} 条
          </UiButton>
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
          <UiAlertDialogAction class="bg-primary text-primary-foreground hover:bg-primary/90" @click="confirmDrawerSave">
            确认覆盖
          </UiAlertDialogAction>
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
          <UiAlertDialogAction class="bg-primary hover:bg-primary/90 text-primary-foreground" @click="confirmDrawerPublish">
            确认发布
          </UiAlertDialogAction>
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
  &quot;common&quot;: {
    &quot;confirm&quot;: &quot;确认&quot;,
    &quot;cancel&quot;: &quot;取消&quot;
  },
  &quot;auth&quot;: {
    &quot;login&quot;: {
      &quot;title&quot;: &quot;登录&quot;
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
          <UiButton variant="outline" @click="showObjectImportModal = false">
            取消
          </UiButton>
          <UiButton v-permission="'term.import'" :disabled="importingObjectJson || !objectImportText.trim() || !objectImportLangCode" @click="submitObjectImport">
            <Loader2 v-if="importingObjectJson" class="w-4 h-4 mr-2 animate-spin" />
            确认导入
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <UiDialog v-model:open="showLocaleReleaseDialog">
      <UiDialogContent class="sm:max-w-xl">
        <UiDialogHeader>
          <UiDialogTitle>线上语言文件</UiDialogTitle>
          <UiDialogDescription>只有点击发布后，公开链接中的 JSON 才会更新。未出现在本次发布中的词条会保留原值。</UiDialogDescription>
        </UiDialogHeader>
        <div v-if="localeReleaseLoading" class="flex min-h-24 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" /> 正在读取线上版本…
        </div>
        <div v-else class="space-y-3">
          <p v-if="localeReleaseError" role="alert" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {{ localeReleaseError }}
          </p>
          <p v-if="localeRelease" class="text-sm text-muted-foreground">
            当前版本 <strong class="font-mono text-foreground">v{{ localeRelease.version }}</strong> · {{ new Date(localeRelease.created_at).toLocaleString('zh-CN') }}
          </p>
          <p v-else-if="!localeReleaseError" class="text-sm text-muted-foreground">
            尚未发布。首次发布后会生成公开链接。
          </p>
          <div v-if="localeRelease" class="max-h-64 space-y-2 overflow-y-auto">
            <div v-for="file in localeRelease.files" :key="file.language_code" class="flex items-center gap-2 rounded-lg border p-2">
              <span class="w-12 shrink-0 font-mono text-xs">{{ file.language_code }}</span>
              <a class="min-w-0 flex-1 truncate font-mono text-xs text-primary underline-offset-2 hover:underline focus-visible:underline" :href="localePublicUrl(file.language_code)" target="_blank" rel="noopener noreferrer">{{ localePublicUrl(file.language_code) }}</a>
              <UiButton variant="ghost" size="sm" :aria-label="`复制 ${file.language_code} 链接`" @click="copyLocaleUrl(file.language_code)">
                <Copy class="size-4" />
              </UiButton>
            </div>
          </div>
        </div>
        <UiDialogFooter v-permission="'locale.publish'">
          <UiButton :disabled="publishingLocaleRelease || localeReleaseLoading || !projectId || isGlobalEditing" @click="showLocalePublishConfirm = true">
            <Loader2 v-if="publishingLocaleRelease" class="mr-2 size-4 animate-spin" />
            发布语言文件
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <UiAlertDialog :open="showLocalePublishConfirm" @update:open="val => showLocalePublishConfirm = val">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>发布语言文件？</UiAlertDialogTitle>
          <UiAlertDialogDescription>当前已发布词条将合并进新的 JSON 文件，公开链接会切换到新版本。未发布的修改和缺失词条会保留线上旧值。</UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>取消</UiAlertDialogCancel>
          <UiAlertDialogAction v-permission="'locale.publish'" @click="publishLocaleRelease">
            发布语言文件
          </UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>

    <TermExportDialog v-model:open="showExportModal" v-model:selected="selectedExportLangs" :languages="targetLanguages" :busy="isExportingJson" :copying-language="copyingLanguageCode" @export="confirmExport" @copy="copyLangJson" />
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
              <UiButton variant="ghost" size="sm" class="h-6 text-[10px] text-muted-foreground hover:text-primary" @click="globalPrompt = DEFAULT_TRANSLATION_PROMPT">
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
              <p class="text-xs font-bold text-gray-500 mb-2 uppercase">
                可用变量
              </p>
              <div class="space-y-1.5">
                <div class="flex justify-between items-center group">
                  <code class="text-[11px] text-primary bg-primary/5 px-1 rounded">{description}</code>
                  <span class="text-[10px] text-muted-foreground">词条的上下文描述</span>
                </div>
                <div class="flex justify-between items-center group">
                  <code class="text-[11px] text-primary bg-primary/5 px-1 rounded">{translations}</code>
                  <span class="text-[10px] text-muted-foreground">当前已有的翻译参考</span>
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
          <UiButton variant="outline" @click="showSettingsModal = false">
            取消
          </UiButton>
          <UiButton v-permission="'project.prompt'" :disabled="isSavingPrompt" @click="saveGlobalPrompt">
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
            :disabled="!can('project.prompt')"
            class="min-h-[180px] font-mono text-sm leading-relaxed p-3 bg-gray-50/50 dark:bg-zinc-900/50 disabled:opacity-80"
            placeholder="输入或修改提示词..."
          />
          <p class="text-[11px] text-muted-foreground">
            此次修改仅对本次翻译有效，不会修改全局设置。<template v-if="can('project.prompt')">
              如需永久修改，请到工具栏的
              <button class="text-primary hover:underline" @click="cancelTranslateDialog(); showSettingsModal = true">
                提示词设置
              </button>中编辑。
            </template>
          </p>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="cancelTranslateDialog">
            取消
          </UiButton>
          <UiButton :disabled="!tempPrompt.trim()" @click="confirmTranslate">
            <Wand2 class="w-3.5 h-3.5 mr-1.5" />
            开始翻译
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

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
          <UiButton variant="outline" @click="showAddTermModal = false">
            取消
          </UiButton>
          <UiButton v-permission="'term.create'" :disabled="submittingTerm" @click="submitNewTerm">
            <Loader2 v-if="submittingTerm" class="size-4 mr-2 animate-spin" />
            新建
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
