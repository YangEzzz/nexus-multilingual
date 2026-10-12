export interface ProjectLanguage {
  code: string
  name: string
  is_source?: boolean
}

export interface Project {
  id: number
  name: string
  code: string
  description: string
  ai_prompt?: string
  created_at: string
  updated_at: string
  languages?: ProjectLanguage[]
}

export interface SessionUser {
  id: number | string
  external_id?: string
  nickname?: string
  name?: string
  email?: string
  avatar_url?: string
  role: string
}

export type TermStatus = 'draft' | 'pending' | 'review' | 'published'
export type Translation = Record<string, string>

export interface TermItem {
  id: string
  module: string
  key: string
  description: string
  translations: Translation
  status: TermStatus
  updatedAt?: string
  created_at?: string
  updated_at?: string
  history?: Array<{ time: string, action: string, user: string }>
}

export interface TermDTO extends Omit<TermItem, 'id' | 'translations'> {
  id: number
  translations?: Array<{ language_code: string, content: string }>
}

export interface ImportResult {
  created: number
  updated: number
}

export interface BatchCreateResult {
  createdCount: number
  terms?: Array<{ term?: { id: number } }>
}
