import { api } from '@/request'

export interface AvailableLanguage {
  id: number
  code: string
  name: string
  sort_order: number
  usage_count: number
  created_at?: string
  updated_at?: string
}

export async function fetchAvailableLanguages(): Promise<AvailableLanguage[]> {
  const response = await api.get<AvailableLanguage[]>({ url: '/languages' })
  return response.data ?? []
}
