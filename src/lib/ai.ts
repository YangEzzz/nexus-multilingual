import { translateWithAI } from '@/api/ai'

export interface AITranslationResult {
  translations: Record<string, string>
  model: string
  credential_source: 'personal'
}

export function requestAITranslation(input: {
  prompt: string
  targetLanguages: string[]
  placeholderRule?: string
}) {
  return translateWithAI<AITranslationResult>({

    data: {
      prompt: input.prompt,
      target_languages: input.targetLanguages,
      placeholder_rule: input.placeholderRule || '',
    },
  }).then(response => response.data)
}
