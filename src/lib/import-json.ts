export interface JsonImportItem { module: string, key: string, content: string }

export function parsePastedObject(input: string): unknown {
  try {
    return JSON.parse(input)
  }
  catch {
    throw new Error('请输入有效 JSON：属性名和文本必须使用双引号，不支持 JavaScript 表达式。')
  }
}

export function normalizeJsonImport(data: unknown, mode: 'flat' | 'object'): JsonImportItem[] {
  if (!data || Array.isArray(data) || typeof data !== 'object')
    throw new Error('格式错误，需为 JSON 对象')
  const items: JsonImportItem[] = []
  const visit = (value: unknown, path: string[], module: string, depth: number) => {
    if (depth > 64)
      throw new Error('JSON 层级过深，最多支持 64 层')
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      items.push({ module, key: path.join('.'), content: String(value) })
      return
    }
    if (mode === 'flat')
      throw new Error('扁平模式只支持文本、数字和布尔值；嵌套结构请使用对象 JSON 导入')
    if (value && !Array.isArray(value) && typeof value === 'object') {
      for (const [key, child] of Object.entries(value))
        visit(child, [...path, key], module, depth + 1)
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (mode === 'object' && value && !Array.isArray(value) && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value))
        visit(child, [childKey], key, 1)
    }
    else {
      visit(value, [key], '', 0)
    }
  }
  return items
}
