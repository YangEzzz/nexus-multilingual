<script setup lang="ts">
import type { Permission } from '@/lib/permissions'
import type { PlaceholderDiff } from '@/lib/placeholders'
import type { ProjectLanguage, TermItem } from '@/types/domain'
import { CheckCircle2, Loader2, Save, Wand2 } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  languages: ProjectLanguage[]
  published: boolean
  dirty: boolean
  canReview: boolean
  canPublish: boolean
  saving: boolean
  reviewing: boolean
  publishing: boolean
  translating: boolean
  error: string
  confirming: boolean
  can: (permission: Permission) => boolean
  placeholderDiff: (term: TermItem, code: string) => PlaceholderDiff
}>()
const emit = defineEmits<{
  close: []
  keyUpdate: [term: TermItem]
  translationUpdate: [term: TermItem]
  translate: []
  review: []
  save: []
  publish: []
}>()
const term = defineModel<TermItem | null>('term', { required: true })
const statusLabels = { draft: '草稿', pending: '待翻译', review: '待发布', published: '已发布' }
const busy = computed(() => props.saving || props.reviewing || props.publishing || props.translating)

function placeholderError(code: string) {
  if (!term.value)
    return ''
  const diff = props.placeholderDiff(term.value, code)
  return [diff.missing.length ? `缺少 ${diff.missing.join(', ')}` : '', diff.extra.length ? `多出 ${diff.extra.join(', ')}` : ''].filter(Boolean).join('；')
}
</script>

<template>
  <UiSheet :open="open" @update:open="value => { if (!value && !confirming) emit('close') }">
    <UiSheetContent class="flex w-full flex-col overflow-hidden p-0 sm:max-w-[500px]">
      <template v-if="term">
        <UiSheetHeader class="border-b bg-muted/30 px-6 py-4">
          <UiSheetTitle class="pr-6">
            词条详情 · {{ statusLabels[term.status] }}
          </UiSheetTitle>
          <UiSheetDescription>编辑内容后保存；AI 翻译需要人工复核。</UiSheetDescription>
        </UiSheetHeader>
        <UiScrollArea class="min-h-0 flex-1">
          <div class="space-y-6 p-6">
            <div class="grid grid-cols-[1fr_2fr] gap-3">
              <div class="space-y-2">
                <UiLabel for="term-editor-module">
                  模块
                </UiLabel>
                <UiInput id="term-editor-module" v-model="term.module" :disabled="busy || published || !can('term.structure')" />
              </div>
              <div class="space-y-2">
                <UiLabel for="term-editor-key">
                  Key
                </UiLabel>
                <UiInput id="term-editor-key" v-model="term.key" :disabled="busy || published || !can('term.structure')" @update:model-value="emit('keyUpdate', term)" />
              </div>
            </div>
            <div class="space-y-2">
              <UiLabel for="term-editor-description">
                上下文描述
              </UiLabel>
              <UiTextarea id="term-editor-description" v-model="term.description" class="min-h-24 resize-none" :disabled="busy || published || !can('term.description')" />
            </div>
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">
                  多语言翻译 · {{ languages.length }} 个语种
                </h3>
                <UiButton v-permission="'term.translate'" variant="outline" size="sm" :disabled="busy" @click="emit('translate')">
                  <Loader2 v-if="translating" class="size-4 animate-spin" /><Wand2 v-else class="size-4" />AI 翻译
                </UiButton>
              </div>
              <div v-for="language in languages" :key="language.code" class="space-y-2">
                <UiLabel :for="`term-editor-${language.code}`">
                  {{ language.name }} ({{ language.code }})
                </UiLabel>
                <UiTextarea
                  :id="`term-editor-${language.code}`"
                  v-model="term.translations[language.code]"
                  class="min-h-16 resize-none"
                  :disabled="busy || !can('term.translate')"
                  :aria-invalid="Boolean(placeholderError(language.code))"
                  :aria-describedby="placeholderError(language.code) ? `term-editor-error-${language.code}` : undefined"
                  @update:model-value="emit('translationUpdate', term)"
                />
                <p v-if="placeholderError(language.code)" :id="`term-editor-error-${language.code}`" class="text-xs text-destructive">
                  {{ placeholderError(language.code) }}
                </p>
              </div>
            </div>
            <div class="space-y-2 border-t pt-4 text-xs text-muted-foreground">
              <p>最后更新：{{ term.updated_at || term.updatedAt || '暂无记录' }}</p>
              <p v-for="(entry, index) in term.history" :key="index">
                {{ entry.time }} · {{ entry.user }} · {{ entry.action }}
              </p>
            </div>
          </div>
        </UiScrollArea>
        <p v-if="error" class="px-4 text-sm text-destructive" role="alert">
          {{ error }}
        </p>
        <UiSheetFooter class="flex-row flex-wrap border-t bg-muted/30 p-4">
          <UiButton variant="outline" :disabled="saving || reviewing || publishing" @click="emit('close')">
            取消
          </UiButton>
          <UiButton v-if="canReview" v-permission="'term.review'" variant="outline" :disabled="busy" @click="emit('review')">
            <CheckCircle2 class="size-4" />{{ dirty ? '保存并校对通过' : '校对通过' }}
          </UiButton>
          <UiButton v-permission="'term.edit'" :disabled="!dirty || busy" @click="emit('save')">
            <Loader2 v-if="saving" class="size-4 animate-spin" /><Save v-else class="size-4" />保存修改
          </UiButton>
          <UiButton v-if="canPublish" v-permission="'term.publish'" :disabled="busy || dirty" @click="emit('publish')">
            发布词条
          </UiButton>
        </UiSheetFooter>
      </template>
    </UiSheetContent>
  </UiSheet>
</template>
