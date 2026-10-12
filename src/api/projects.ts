import type { EntityId, MutationOptions, QueryOptions } from './types'
import { api } from '@/request'
import { encodeId } from './types'

export function listProjects<T = unknown>(options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects` })
}

export function createProject<T = unknown>(options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects` })
}

export function getProject<T = unknown>(projectId: EntityId, options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects/${encodeId(projectId)}` })
}

export function updateProject<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/update` })
}

export function deleteProject<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/delete` })
}

export function listProjectLanguages<T = unknown>(projectId: EntityId, options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects/${encodeId(projectId)}/languages` })
}

export function updateProjectLanguages<T = unknown>(projectId: EntityId, options: MutationOptions = {}) {
  return api.post<T>({ ...options, url: `/projects/${encodeId(projectId)}/languages/update` })
}

export function getProjectDashboard<T = unknown>(projectId: EntityId, options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects/${encodeId(projectId)}/dashboard` })
}

export function listProjectLogs<T = unknown>(projectId: EntityId, options: QueryOptions = {}) {
  return api.get<T>({ ...options, url: `/projects/${encodeId(projectId)}/logs` })
}
