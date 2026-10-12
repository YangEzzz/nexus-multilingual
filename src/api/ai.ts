import type { MutationOptions, QueryOptions } from './types'
import { api } from '@/request'

export function getAISettings<T = unknown>(options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/ai/settings` })
}

export function saveAISettings<T = unknown>(options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/ai/settings` })
}

export function deleteAISettings<T = unknown>(options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/ai/settings/delete` })
}

export function translateWithAI<T = unknown>(options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/ai/translate` })
}
