import type { AxiosRequestConfig } from 'axios'

export type EntityId = string | number
export type QueryOptions = Pick<AxiosRequestConfig, 'params' | 'signal'>
export type MutationOptions = QueryOptions & { data?: unknown }
export const encodeId = (id: EntityId) => encodeURIComponent(String(id))
