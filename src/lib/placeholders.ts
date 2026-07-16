export interface PlaceholderDiff {
  missing: string[]
  extra: string[]
}

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_.-]+\}/g

export function extractPlaceholders(text = '') {
  return Array.from(new Set(text.match(PLACEHOLDER_RE) ?? [])).sort()
}

export function diffPlaceholders(source = '', target = ''): PlaceholderDiff {
  const sourceSet = new Set(extractPlaceholders(source))
  const targetSet = new Set(extractPlaceholders(target))

  return {
    missing: [...sourceSet].filter(item => !targetSet.has(item)),
    extra: [...targetSet].filter(item => !sourceSet.has(item)),
  }
}

export function hasPlaceholderMismatch(source = '', target = '') {
  const diff = diffPlaceholders(source, target)
  return diff.missing.length > 0 || diff.extra.length > 0
}
