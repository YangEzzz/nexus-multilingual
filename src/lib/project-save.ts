import type { ProjectLanguage } from '@/types/domain'
import { errorMessage } from '@/lib/errors'

export class ProjectLanguageSaveError extends Error {
  constructor(cause: unknown) {
    super(`项目资料已保存，语言配置未完成：${errorMessage(cause)}。可重试保存。`)
    this.name = 'ProjectLanguageSaveError'
  }
}

interface ProjectForm { id: number, name: string, code: string, description: string }
interface ProjectSaveAPI {
  create: (form: ProjectForm) => Promise<number>
  update: (form: ProjectForm) => Promise<void>
  languages: (id: number, languages: ProjectLanguage[]) => Promise<void>
}

/** Persist the created ID before the second step so retries can never create it twice. */
export async function saveProjectConfiguration(form: ProjectForm, languages: ProjectLanguage[], api: ProjectSaveAPI) {
  if (form.id)
    await api.update({ ...form })
  else
    form.id = await api.create({ ...form })
  if (!form.id)
    throw new Error('服务器未返回项目 ID，请刷新项目列表确认创建结果。')
  try {
    await api.languages(form.id, languages)
  }
  catch (cause) {
    throw new ProjectLanguageSaveError(cause)
  }
}
