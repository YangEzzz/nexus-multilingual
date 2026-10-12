import type { EntityId, MutationOptions, QueryOptions } from './types'
import { api } from '@/request'
import { encodeId } from './types'

export function listTerms<T = unknown>(projectId: EntityId, options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms` })
}

export function createTerm<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms` })
}

export function updateTerm<T = unknown>(projectId: EntityId, termId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/${encodeId(termId)}/update` })
}

export function deleteTerm<T = unknown>(projectId: EntityId, termId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/${encodeId(termId)}/delete` })
}

export function publishTerm<T = unknown>(projectId: EntityId, termId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/${encodeId(termId)}/publish` })
}

export function batchUpdateTerms<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/batch-update` })
}

export function batchCreateTerms<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/batch-create` })
}

export function importTermsJson<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/import-json` })
}

export function previewTermBulk<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/bulk/preview` })
}

export function executeTermBulk<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/bulk/execute` })
}

export function copyTermExport<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/terms/export/copy` })
}

export function downloadTermsJson(projectId: EntityId, options: MutationOptions = {}) {
  return api.downloadPost({ ...options, url: `/projects/${encodeId(projectId)}/terms/export/json` })
}

export function downloadTermsExcel(projectId: EntityId, options: MutationOptions = {}) {
  return api.downloadPost({ ...options, url: `/projects/${encodeId(projectId)}/terms/export/excel` })
}
