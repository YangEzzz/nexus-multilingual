import type { EntityId, MutationOptions, QueryOptions } from './types'
import { api } from '@/request'
import { apiBaseURL } from '@/utils/session'
import { encodeId } from './types'

export function getLocaleRelease<T = unknown>(projectId: EntityId, options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects/${encodeId(projectId)}/locale-release` })
}

export function publishLocaleRelease<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/locale-release/publish` })
}

export function getPublicLocaleUrl(projectCode: string, languageCode: string) {
  return new URL(`${apiBaseURL}/public/locales/${encodeURIComponent(projectCode)}/${encodeURIComponent(languageCode)}.json`, window.location.href).href
}
