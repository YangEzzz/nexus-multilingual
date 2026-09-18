<script setup lang="ts">
import type { AvailableLanguage } from '@/lib/available-languages'
import { Languages, Loader2, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { toast } from 'vue-sonner'
import { fetchAvailableLanguages } from '@/lib/available-languages'
import { api } from '@/request'
import { useAuthStore } from '@/store/auth'

defineOptions({ name: 'AvailableLanguages' })

const authStore = useAuthStore()
const canManage = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'owner' || Number(authStore.user?.id) === 1)

const languages = ref<AvailableLanguage[]>([])
const loading = ref(false)
const loadError = ref('')
const showFormDialog = ref(false)
const editingLanguage = ref<AvailableLanguage | null>(null)
const submitting = ref(false)
const formError = ref('')
const formData = ref({ code: '', name: '', sort_order: 0 })

const showDeleteDialog = ref(false)
const deletingLanguage = ref<AvailableLanguage | null>(null)
const deleting = ref(false)
const deleteError = ref('')

const loadLanguages = async () => {
  loading.value = true
  loadError.value = ''
  try {
    languages.value = await fetchAvailableLanguages()
  }
  catch (error: any) {
    loadError.value = error.message || '无法获取可选语言'
  }
  finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  if (!canManage.value)
    return
  editingLanguage.value = null
  formData.value = { code: '', name: '', sort_order: (languages.value.length + 1) * 10 }
  formError.value = ''
  showFormDialog.value = true
}

const openEditDialog = (language: AvailableLanguage) => {
  if (!canManage.value)
    return
  editingLanguage.value = language
  formData.value = {
    code: language.code,
    name: language.name,
    sort_order: language.sort_order,
  }
  formError.value = ''
  showFormDialog.value = true
}

const validateForm = () => {
  formData.value.code = formData.value.code.trim().toLowerCase()
  formData.value.name = formData.value.name.trim()
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(formData.value.code) || formData.value.code.length > 20) {
    formError.value = '语言代码必须以字母开头，只能包含小写字母、数字和连字符，且不超过 20 个字符。'
    return false
  }
  if (!formData.value.name || Array.from(formData.value.name).length > 100) {
    formError.value = '语言名称不能为空且不能超过 100 个字符。'
    return false
  }
  formError.value = ''
  return true
}

const saveLanguage = async () => {
  if (!canManage.value || submitting.value || !validateForm())
    return
  submitting.value = true
  try {
    const url = editingLanguage.value
      ? `/languages/${editingLanguage.value.id}/update`
      : '/languages'
    await api.post({ url, data: formData.value })
    toast.success(editingLanguage.value ? '可选语言已更新' : '可选语言已创建')
    showFormDialog.value = false
    await loadLanguages()
  }
  catch (error: any) {
    formError.value = error.message || '保存失败，请检查后重试。'
  }
  finally {
    submitting.value = false
  }
}

const requestDelete = (language: AvailableLanguage) => {
  if (!canManage.value || language.usage_count > 0)
    return
  deletingLanguage.value = language
  deleteError.value = ''
  showDeleteDialog.value = true
}

const deleteLanguage = async () => {
  if (!deletingLanguage.value || deleting.value)
    return
  deleting.value = true
  deleteError.value = ''
  try {
    await api.post({ url: `/languages/${deletingLanguage.value.id}/delete` })
    toast.success('可选语言已删除')
    showDeleteDialog.value = false
    await loadLanguages()
  }
  catch (error: any) {
    deleteError.value = error.message || '删除失败，请检查后重试。'
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  document.title = '可选语言 — Nexus Multilingual'
  loadLanguages()
})
</script>

<template>
  <div class="min-h-0 space-y-6 p-4 lg:p-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">
          可选语言
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          维护创建项目时可以选择的语言名称与代码
        </p>
      </div>

      <UiTooltip>
        <UiTooltipTrigger as-child>
          <span>
            <UiButton :disabled="!canManage" @click="openCreateDialog">
              <Plus class="mr-2 size-4" />
              新增语言
            </UiButton>
          </span>
        </UiTooltipTrigger>
        <UiTooltipContent v-if="!canManage">
          仅管理员可以管理可选语言
        </UiTooltipContent>
      </UiTooltip>
    </header>

    <section class="overflow-hidden rounded-3xl border border-border bg-card shadow-sm" aria-labelledby="language-list-title">
      <div class="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div>
          <h2 id="language-list-title" class="font-medium text-foreground">
            语言库
          </h2>
          <p class="mt-0.5 text-xs text-muted-foreground">
            共 {{ languages.length }} 种；已被项目使用的语言不能删除或修改代码。
          </p>
        </div>
        <UiButton variant="ghost" size="icon" aria-label="刷新可选语言" :disabled="loading" @click="loadLanguages">
          <RefreshCcw class="size-4" :class="loading && 'animate-spin'" />
        </UiButton>
      </div>

      <div v-if="loading" class="flex min-h-64 items-center justify-center text-muted-foreground" role="status" aria-live="polite">
        <Loader2 class="mr-2 size-5 animate-spin" />
        正在加载可选语言
      </div>

      <div v-else-if="loadError" class="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <p class="text-sm text-destructive">
          {{ loadError }}
        </p>
        <UiButton variant="outline" size="sm" @click="loadLanguages">
          重新加载
        </UiButton>
      </div>

      <div v-else-if="languages.length === 0" class="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
        <div class="flex size-12 items-center justify-center rounded-xl border border-dashed bg-muted/30">
          <Languages class="size-5 text-muted-foreground" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">
            还没有可选语言
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            新增后即可在创建和编辑项目时选择。
          </p>
        </div>
        <UiButton v-if="canManage" variant="outline" size="sm" @click="openCreateDialog">
          新增第一种语言
        </UiButton>
      </div>

      <div v-else class="overflow-x-auto">
        <UiTable>
          <UiTableHeader>
            <UiTableRow>
              <UiTableHead class="w-20">
                顺序
              </UiTableHead>
              <UiTableHead class="min-w-44">
                语言名称
              </UiTableHead>
              <UiTableHead class="min-w-40">
                语言代码
              </UiTableHead>
              <UiTableHead class="min-w-32">
                使用情况
              </UiTableHead>
              <UiTableHead class="w-28 text-right">
                操作
              </UiTableHead>
            </UiTableRow>
          </UiTableHeader>
          <UiTableBody>
            <UiTableRow v-for="language in languages" :key="language.id">
              <UiTableCell class="tabular-nums text-muted-foreground">
                {{ language.sort_order }}
              </UiTableCell>
              <UiTableCell class="font-medium">
                {{ language.name }}
              </UiTableCell>
              <UiTableCell><code class="rounded bg-muted px-2 py-1 text-xs">{{ language.code }}</code></UiTableCell>
              <UiTableCell>
                <span v-if="language.usage_count > 0" class="text-sm text-foreground">{{ language.usage_count }} 个项目</span>
                <span v-else class="text-sm text-muted-foreground">未使用</span>
              </UiTableCell>
              <UiTableCell>
                <div class="flex justify-end gap-1">
                  <UiTooltip>
                    <UiTooltipTrigger as-child>
                      <span>
                        <UiButton
                          variant="ghost"
                          size="icon"
                          :aria-label="`编辑${language.name}`"
                          :disabled="!canManage"
                          @click="openEditDialog(language)"
                        >
                          <Pencil class="size-4" />
                        </UiButton>
                      </span>
                    </UiTooltipTrigger>
                    <UiTooltipContent v-if="!canManage">
                      仅管理员可以编辑
                    </UiTooltipContent>
                  </UiTooltip>
                  <UiTooltip>
                    <UiTooltipTrigger as-child>
                      <span>
                        <UiButton
                          variant="ghost"
                          size="icon"
                          class="text-destructive hover:text-destructive"
                          :aria-label="`删除${language.name}`"
                          :disabled="!canManage || language.usage_count > 0"
                          @click="requestDelete(language)"
                        >
                          <Trash2 class="size-4" />
                        </UiButton>
                      </span>
                    </UiTooltipTrigger>
                    <UiTooltipContent v-if="language.usage_count > 0">
                      已有项目使用，不能删除
                    </UiTooltipContent>
                    <UiTooltipContent v-else-if="!canManage">
                      仅管理员可以删除
                    </UiTooltipContent>
                  </UiTooltip>
                </div>
              </UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </div>
    </section>

    <UiDialog v-model:open="showFormDialog">
      <UiDialogContent class="sm:max-w-md">
        <form novalidate @submit.prevent="saveLanguage">
          <UiDialogHeader>
            <UiDialogTitle>{{ editingLanguage ? '编辑可选语言' : '新增可选语言' }}</UiDialogTitle>
            <UiDialogDescription>语言代码将用于 Excel 表头、JSON 文件名和翻译数据标识。</UiDialogDescription>
          </UiDialogHeader>

          <div class="grid gap-4 py-5">
            <div class="grid gap-2">
              <UiLabel for="language-name">
                语言名称
              </UiLabel>
              <UiInput id="language-name" v-model="formData.name" maxlength="100" placeholder="例如：阿拉伯语" :aria-invalid="Boolean(formError)" />
            </div>
            <div class="grid gap-2">
              <UiLabel for="language-code">
                语言代码
              </UiLabel>
              <UiInput
                id="language-code"
                v-model="formData.code"
                maxlength="20"
                class="font-mono"
                placeholder="例如：ar"
                :aria-invalid="Boolean(formError)"
                :disabled="Boolean(editingLanguage?.usage_count)"
              />
              <p class="text-xs text-muted-foreground">
                {{ editingLanguage?.usage_count ? '该语言已被项目使用，代码不可修改。' : '使用小写字母、数字和连字符。' }}
              </p>
            </div>
            <div class="grid gap-2">
              <UiLabel for="language-sort-order">
                显示顺序
              </UiLabel>
              <UiInput id="language-sort-order" v-model.number="formData.sort_order" type="number" min="0" step="10" />
            </div>
            <p v-if="formError" role="alert" class="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {{ formError }}
            </p>
          </div>

          <UiDialogFooter>
            <UiButton type="button" variant="outline" :disabled="submitting" @click="showFormDialog = false">
              取消
            </UiButton>
            <UiButton type="submit" :disabled="submitting">
              <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
              {{ submitting ? '正在保存' : '保存语言' }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <UiAlertDialog v-model:open="showDeleteDialog">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>删除可选语言？</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            将永久删除“{{ deletingLanguage?.name }}（{{ deletingLanguage?.code }}）”。删除后，新项目将无法再选择它。
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <p v-if="deleteError" role="alert" class="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {{ deleteError }}
        </p>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel :disabled="deleting">
            取消
          </UiAlertDialogCancel>
          <UiButton class="bg-destructive text-destructive-foreground hover:bg-destructive/90" :disabled="deleting" @click="deleteLanguage">
            <Loader2 v-if="deleting" class="mr-2 size-4 animate-spin" />
            {{ deleting ? '正在删除' : '永久删除' }}
          </UiButton>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </div>
</template>
