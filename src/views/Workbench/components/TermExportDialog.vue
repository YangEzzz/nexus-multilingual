<script setup lang="ts">
import type { ProjectLanguage } from '@/types/domain'
import { Copy, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  languages: ProjectLanguage[]
  busy: boolean
  copyingLanguage: string
}>()
const emit = defineEmits<{
  export: []
  copy: [code: string, name: string]
}>()
const open = defineModel<boolean>('open', { required: true })
const selected = defineModel<string[]>('selected', { required: true })
function selectLanguage(code: string, checked: boolean | 'indeterminate') {
  selected.value = checked === true
    ? [...new Set([...selected.value, code])]
    : selected.value.filter(value => value !== code)
}
</script>

<template>
  <UiDialog :open="open" @update:open="value => { if (!busy) open = value }">
    <UiDialogContent class="sm:max-w-md">
      <UiDialogHeader>
        <UiDialogTitle>导出多语言 JSON</UiDialogTitle>
        <UiDialogDescription>每种语言生成一个 JSON 文件，并打包为 ZIP 下载。</UiDialogDescription>
      </UiDialogHeader>
      <div class="space-y-3 py-3">
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
        <UiButton variant="outline" :disabled="busy" @click="open = false">
          取消
        </UiButton>
        <UiButton v-permission="'term.export'" :disabled="busy || !selected.length" @click="emit('export')">
          <Loader2 v-if="busy" class="size-4 animate-spin" />
          {{ busy ? '正在打包…' : `打包下载 (${selected.length})` }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
