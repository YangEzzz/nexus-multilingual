import type { ProjectLanguage } from '@/types/domain'

/** Keep legacy projects without an explicit source flag consistent with the workbench. */
export function resolveSourceLanguage<T extends ProjectLanguage>(languages: readonly T[]): T | undefined {
  return languages.find(language => language.is_source)
    || languages.find(language => language.code === 'cn')
    || languages.find(language => language.code === 'zh')
    || languages.find(language => language.code === 'zh-CN')
    || languages.find(language => language.code === 'en')
    || languages[0]
}
