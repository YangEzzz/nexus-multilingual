<script setup lang="ts">
import type { ProjectLanguage } from '@/types/domain'
import { Copy, Loader2 } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { copyTermExport } from '@/api/terms'
import { usePermission } from '@/composables/use-permission'
import { useRequestScope } from '@/composables/use-request-scope'
import { copyText } from '@/lib/clipboard'
import { errorMessage } from '@/lib/errors'

const props = defineProps<{
  languages: ProjectLanguage[]
  busy: boolean
  copyingLanguage: string
  projectId: string
  scope: object
  scopeLabel: string
  variant: 'json' | 'pairs'
}>()
const emit = defineEmits<{
  export: []
  copy: [code: string, name: string]
}>()
const open = defineModel<boolean>('open', { required: true })
const selected = defineModel<string[]>('selected', { required: true })
const { can } = usePermission()
const snippetLanguage = ref('')
const preview = ref<{ content: string, count: number, skipped: number } | null>(null)
const loading = ref(false)
const copying = ref(false)
const error = ref('')
const requests = useRequestScope(() => `${props.projectId}:${open.value}:${snippetLanguage.value}:${can('term.export')}`)

async function loadPreview() {
  requests.invalidate()
  preview.value = null
  error.value = ''
  loading.value = false
  if (!open.value || props.variant !== 'pairs' || !snippetLanguage.value || !can('term.export'))
    return
  const ticket = requests.request()
  loading.value = true
  try {
    const response = await copyTermExport<{ content: string, count: number, skipped: number }>(props.projectId, {
      signal: AbortSignal.any([ticket.signal, AbortSignal.timeout(15000)]),
      data: { scope: props.scope, language: snippetLanguage.value, format: 'pairs' },
    })
    if (ticket.isCurrent())
      preview.value = response.data
  }
  catch (cause) {
    if (ticket.isCurrent())
      error.value = errorMessage(cause, '读取键值对失败，请重试。')
  }
  finally {
    if (ticket.isCurrent())
      loading.value = false
    ticket.release()
  }
}

watch(() => open.value, (value) => {
  if (value)
    snippetLanguage.value = props.languages[0]?.code || ''
}, { immediate: true })
watch(() => [open.value, props.projectId, props.scope, props.variant, snippetLanguage.value, can('term.export')], loadPreview, { immediate: true })

async function copyPairs() {
  if (!can('term.export') || !preview.value?.count || loading.value || copying.value)
    return
  copying.value = true
  error.value = ''
  try {
    await copyText(preview.value.content)
    toast.success('键值对已复制', { description: `已复制 ${preview.value.count} 条词条，可粘贴到现有语言文件中。` })
  }
  catch (cause) {
    error.value = errorMessage(cause, '复制失败，请手动选择预览内容复制。')
  }
  finally {
    copying.value = false
  }
}
function selectLanguage(code: string, checked: boolean | 'indeterminate') {
  selected.value = checked === true
    ? [...new Set([...selected.value, code])]
    : selected.value.filter(value => value !== code)
}
</script>

<template>
  <UiDialog :open="open" @update:open="value => { if (!busy && !copying) open = value }">
    <UiDialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <UiDialogHeader>
        <UiDialogTitle>{{ variant === 'pairs' ? '复制选中词条的键值对' : '导出多语言 JSON' }}</UiDialogTitle>
        <UiDialogDescription>
          {{ scopeLabel }}。{{ variant === 'pairs' ? '选择语言后复制片段，合并到项目现有语言文件。' : '每种语言生成一个 JSON 文件，并打包为 ZIP 下载。' }}
        </UiDialogDescription>
      </UiDialogHeader>
      <div v-if="variant === 'pairs'" class="min-w-0 space-y-3 py-3">
        <UiLabel for="snippet-language">
          译文语言
        </UiLabel>
        <UiSelect v-model="snippetLanguage" :disabled="copying || !languages.length">
          <UiSelectTrigger id="snippet-language" class="w-full">
            <UiSelectValue placeholder="选择语言" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="item in languages" :key="item.code" :value="item.code">
              {{ item.name }} ({{ item.code }})
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
        <p id="snippet-help" class="text-xs leading-relaxed text-muted-foreground">
          使用原始 Key，不附加模块名或外层大括号。粘贴到对应模块或对象内，并检查相邻项的逗号。
        </p>
        <div class="flex min-h-6 items-center justify-between text-xs" aria-live="polite">
          <span v-if="loading" class="flex items-center gap-2 text-muted-foreground"><Loader2 class="size-3.5 animate-spin" />正在生成预览…</span>
          <span v-else-if="preview">可复制 {{ preview.count }} 条<span v-if="preview.skipped">，已跳过 {{ preview.skipped }} 条空译文</span></span>
          <span v-else-if="!languages.length">项目尚未配置语言</span>
        </div>
        <UiTextarea
          id="snippet-preview"
          :model-value="preview?.content || ''"
          readonly
          aria-label="键值对预览，可手动选择复制"
          aria-describedby="snippet-help"
          :aria-busy="loading"
          class="h-60 resize-none overflow-auto whitespace-pre font-mono text-xs [field-sizing:fixed]"
          :placeholder="loading ? '正在读取选中词条…' : '没有可复制的键值对'"
        />
        <p v-if="error" role="alert" class="text-sm text-destructive">
          {{ error }}
        </p>
        <UiButton v-if="error && !preview" variant="outline" size="sm" :disabled="loading" @click="loadPreview">
          重新生成
        </UiButton>
      </div>
      <div v-else class="space-y-3 py-3">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium">
            选择目标语种
          </h4>
          <div class="flex gap-2">
            <UiButton variant="ghost" size="sm" :disabled="busy" @click="selected = props.languages.map(language => language.code)">
              全选
            </UiButton>
            <UiButton variant="ghost" size="sm" :disabled="busy" @click="selected = []">
              清空
            </UiButton>
          </div>
        </div>
        <UiScrollArea class="h-[300px] rounded-md border p-2">
          <div v-for="language in languages" :key="language.code" class="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
            <UiCheckbox
              :id="`export-${language.code}`"
              :model-value="selected.includes(language.code)"
              :disabled="busy"
              @update:model-value="checked => selectLanguage(language.code, checked)"
            />
            <label :for="`export-${language.code}`" class="min-w-0 flex-1 cursor-pointer">
              <span class="block truncate text-sm font-medium">{{ language.name }}</span>
              <span class="block font-mono text-xs text-muted-foreground">{{ language.code }}</span>
            </label>
            <UiButton variant="ghost" size="icon" :disabled="busy || Boolean(copyingLanguage)" :aria-label="`复制 ${language.name} JSON`" @click="emit('copy', language.code, language.name)">
              <Loader2 v-if="copyingLanguage === language.code" class="size-4 animate-spin" />
              <Copy v-else class="size-4" />
            </UiButton>
          </div>
        </UiScrollArea>
      </div>
      <UiDialogFooter>
        <UiButton variant="outline" :disabled="busy || copying" @click="open = false">
          关闭
        </UiButton>
        <UiButton v-if="variant === 'pairs'" v-permission="'term.export'" class="min-w-28" :disabled="loading || copying || !preview?.count" :aria-busy="copying" @click="copyPairs">
          <Loader2 v-if="copying" class="size-4 animate-spin" />
          <Copy v-else class="size-4" />
          复制键值对
        </UiButton>
        <UiButton v-else v-permission="'term.export'" :disabled="busy || !selected.length" @click="emit('export')">
          <Loader2 v-if="busy" class="size-4 animate-spin" />
          {{ busy ? '正在打包…' : `打包下载 (${selected.length})` }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
