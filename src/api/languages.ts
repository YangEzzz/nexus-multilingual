import type { EntityId, MutationOptions, QueryOptions } from './types'
import { api } from '@/request'
import { encodeId } from './types'

export function listLanguages<T = unknown>(options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/languages` })
}

export function createLanguage<T = unknown>(options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/languages` })
}

export function updateLanguage<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/languages/${encodeId(projectId)}/update` })
}

export function deleteLanguage<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/languages/${encodeId(projectId)}/delete` })
}
