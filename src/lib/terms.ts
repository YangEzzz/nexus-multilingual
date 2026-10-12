import type { TermDTO, TermItem, Translation } from '@/types/domain'

export const DEFAULT_TRANSLATION_PROMPT = `翻译以下内容，这是一个智能体APP的内容并将其翻译为本地化语言。
待翻译原文参考：
描述和上下文: {description}
现有参考翻译 (若有可参考，若无请根据键名和描述推断):
{translations}`

export function mapApiTerm(term: TermDTO): TermItem {
  return {
    ...term,
    id: String(term.id),
    translations: Object.fromEntries((term.translations ?? []).map(item => [item.language_code, item.content])),
  }
}

export function termUpdatePayload(term: TermItem) {
  return {
    module: term.module,
    key: term.key,
    description: term.description,
    status: term.status,
    translations: { ...term.translations },
  }
}

export function buildTranslationPrompt(term: TermItem, template: string): string {
  const reference = Object.entries(term.translations)
    .filter(([, text]) => text)
    .map(([code, text]) => `${code}: ${text}`)
    .join('\n')
  return template.split('{description}').join(term.description || '无').split('{translations}').join(reference || '无')
}

export function applyTranslation(term: TermItem, translations: Translation, codes: string[]) {
  for (const code of codes) {
    const text = translations[code]
    if (typeof text === 'string')
      term.translations[code] = text
  }
  // AI output still needs human review before publication.
  term.status = term.status === 'published' ? 'review' : 'pending'
}
