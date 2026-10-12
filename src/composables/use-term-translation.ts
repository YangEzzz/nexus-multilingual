import type { AITranslationResult, requestAITranslation } from '@/lib/ai'
import type { TermItem } from '@/types/domain'
import { applyTranslation, buildTranslationPrompt } from '@/lib/terms'

interface TranslationOptions {
  template: string
  languages: string[]
  placeholderRule: string
  isActive: () => boolean
}

/** Both editor surfaces share the same prompt, state policy and response ownership. */
export function useTermTranslation(
  request: typeof requestAITranslation,
  capture: () => { isCurrent: () => boolean },
) {
  const pending = new WeakSet<TermItem>()
  async function translate(term: TermItem, options: TranslationOptions): Promise<'success' | 'skipped'> {
    if (pending.has(term))
      return 'skipped'
    pending.add(term)
    const ticket = capture()
    const original = JSON.stringify(term)
    try {
      const result: AITranslationResult = await request({
        prompt: buildTranslationPrompt(term, options.template),
        targetLanguages: [...options.languages],
        placeholderRule: options.placeholderRule,
      })
      if (!ticket.isCurrent() || !options.isActive() || JSON.stringify(term) !== original)
        return 'skipped'
      applyTranslation(term, result.translations, options.languages)
      return 'success'
    }
    finally {
      pending.delete(term)
    }
  }
  return { translate }
}
