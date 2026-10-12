import { listLanguages } from '@/api/languages'

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
  const response = await listLanguages<AvailableLanguage[]>()
  return response.data ?? []
}
