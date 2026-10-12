import type { ComponentPublicInstance, ComputedRef, Ref } from 'vue'
import type { Permission } from '@/lib/permissions'
import type { BatchCreateResult, ImportResult, ProjectLanguage, TermItem, Translation } from '@/types/domain'
import { nextTick, ref } from 'vue'
import { toast } from 'vue-sonner'
import { batchCreateTerms, importTermsJson } from '@/api/terms'
import { errorMessage } from '@/lib/errors'
import { normalizeJsonImport, parsePastedObject } from '@/lib/import-json'

interface ImportOptions {
  projectId: ComputedRef<string>
  targetLanguages: Ref<ProjectLanguage[]>
  availableLanguages: Ref<ProjectLanguage[]>
  sourceLanguageCode: ComputedRef<string | undefined>
  terms: Ref<TermItem[]>
  can: (permission: Permission) => boolean
  loadTerms: () => Promise<void>
  BATCH_CREATE_LIMIT: number
}

export function useTermImport(options: ImportOptions) {
  const { projectId, targetLanguages, availableLanguages, sourceLanguageCode, terms, can, loadTerms, BATCH_CREATE_LIMIT } = options
  const excelFileInput = ref<HTMLInputElement | null>(null)
  const jsonFileInput = ref<HTMLInputElement | null>(null)
  function bindExcelFileInput(element: Element | ComponentPublicInstance | null) {
    excelFileInput.value = element instanceof HTMLInputElement ? element : null
  }
  function bindJsonFileInput(element: Element | ComponentPublicInstance | null) {
    jsonFileInput.value = element instanceof HTMLInputElement ? element : null
  }
  const importingExcel = ref(false)
  const excelImportStage = ref('')

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

  function openObjectImportModal() {
    objectImportLangCode.value = sourceLanguageCode.value || targetLanguages.value[0]?.code || ''
    objectImportText.value = ''
    showObjectImportModal.value = true
  }

  async function submitObjectImport() {
    if (importingObjectJson.value)
      return
    if (!can('term.import'))
      return
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

      const res = await importTermsJson<ImportResult>(projectId.value, {

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
      }
      else {
        toast.error('导入失败', { description: res.message })
      }
    }
    catch (e: unknown) {
      toast.error('导入失败', { description: errorMessage(e) })
    }
    finally {
      importingObjectJson.value = false
    }
  }

  async function handleJsonImport(event: Event) {
    if (!can('term.import'))
      return
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0)
      return

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
        const res = await importTermsJson<ImportResult>(projectId.value, {

          data: { language_code: langCode, items },
        })
        if (res.code === 200) {
          totalCreated += res.data.created
          totalUpdated += res.data.updated
        }
        else {
          errors.push(`「${file.name}」：${res.message}`)
        }
      }
      catch (e: unknown) {
        errors.push(`「${file.name}」：${errorMessage(e)}`)
      }
    }

    if (errors.length > 0) {
      toast.warning(`导入完成（含 ${errors.length} 个错误）`, {
        description: errors.join('\n'),
      })
    }
    else {
      toast.success(`全部导入成功（${files.length} 个文件）`, {
        description: `新建词条：${totalCreated} 个，更新翻译：${totalUpdated} 条`,
      })
    }

    loadTerms()
    importingJson.value = false
    if (target)
      target.value = ''
  }

  async function handleExcelImport(event: Event) {
    if (!can('term.import'))
      return
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

      const XLSX = await import('xlsx')
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
      const json = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 })

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
      header.forEach((col, idx) => {
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
      const res = await batchCreateTerms<BatchCreateResult>(projectId.value, {

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
    catch (error: unknown) {
      console.error(error)
      toast.error('导入失败', {
        id: importToastId,
        description: errorMessage(error) || 'Excel 解析出现异常。',
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

  return { bindExcelFileInput, bindJsonFileInput, importingExcel, excelImportStage, triggerExcelImport, triggerJsonImport, importingJson, showObjectImportModal, objectImportText, objectImportLangCode, importingObjectJson, openObjectImportModal, submitObjectImport, handleJsonImport, handleExcelImport }
}
