<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'projects' })

import { Plus, Folder, Trash2, Pencil, ArrowRight, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { api } from '@/request'

interface I18nProject {
  id: number
  name: string
  code: string
  description: string
  created_at: string
  updated_at: string
  languages?: Array<{ code: string; name: string }>
}

// All supported languages (global dictionary)
const ALL_LANGUAGES = [
  { code: 'cn', name: '简体中文' },
  { code: 'cht', name: '繁体中文' },
  { code: 'en', name: '英文' },
  { code: 'jp', name: '日语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' },
  { code: 'de', name: '德语' },
  { code: 'fr', name: '法语' },
  { code: 'ko', name: '韩语' },
  { code: 'th', name: '泰语' },
  { code: 'vi', name: '越南语' },
  { code: 'ind', name: '印尼语' },
  { code: 'tr', name: '土耳其语' },
  { code: 'bn', name: '孟加拉语' },
  { code: 'pl', name: '波兰语' },
  { code: 'it', name: '意大利语' },
]

const router = useRouter()
const projects = ref<I18nProject[]>([])
const loading = ref(true)

// Dialog state
const showDialog = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const formData = ref({ id: 0, name: '', code: '', description: '' })
const selectedLangCodes = ref<string[]>([])

// Delete dialog
const showDeleteDialog = ref(false)
const deletingProject = ref<I18nProject | null>(null)

async function loadProjects() {
  loading.value = true
  try {
    const res = await api.get<I18nProject[]>({ url: '/projects' })
    projects.value = res.data ?? []
  } catch (e: any) {
    toast.error('加载项目失败', { description: e.message })
  } finally {
    loading.value = false
  }
}

function toggleLang(code: string) {
  const idx = selectedLangCodes.value.indexOf(code)
  if (idx === -1) selectedLangCodes.value.push(code)
  else selectedLangCodes.value.splice(idx, 1)
}

function openCreate() {
  isEditing.value = false
  formData.value = { id: 0, name: '', code: '', description: '' }
  selectedLangCodes.value = ALL_LANGUAGES.map(l => l.code)
  showDialog.value = true
}

function openEdit(project: I18nProject) {
  isEditing.value = true
  formData.value = { id: project.id, name: project.name, code: project.code, description: project.description }
  selectedLangCodes.value = (project.languages || []).map(l => l.code)
  showDialog.value = true
}
async function saveLanguages(projectId: number) {
  const langs = ALL_LANGUAGES.filter(l => selectedLangCodes.value.includes(l.code))
  await api.post({ url: `/projects/${projectId}/languages/update`, data: langs })
}

function confirmDelete(project: I18nProject) {
  deletingProject.value = project
  showDeleteDialog.value = true
}

async function submitForm() {
  if (!formData.value.name || !formData.value.code) {
    toast.warning('请填写项目名称和标识符')
    return
  }
  if (selectedLangCodes.value.length === 0) {
    toast.warning('请至少选择一种语言')
    return
  }
  submitting.value = true
  try {
    if (isEditing.value) {
      await api.post({ url: `/projects/${formData.value.id}/update`, data: formData.value })
      await saveLanguages(formData.value.id)
      toast.success('更新成功')
    } else {
      const res = await api.post<any>({ url: '/projects', data: formData.value })
      const newId = res.data?.id
      if (newId) await saveLanguages(newId)
      toast.success('项目创建成功')
    }
    showDialog.value = false
    loadProjects()
  } catch (e: any) {
    toast.error('操作失败', { description: e.message })
  } finally {
    submitting.value = false
  }
}

async function doDelete() {
  if (!deletingProject.value) return
  try {
    await api.post({ url: `/projects/${deletingProject.value.id}/delete` })
    toast.success('项目已删除')
    showDeleteDialog.value = false
    loadProjects()
  } catch (e: any) {
    toast.error('删除失败', { description: e.message })
  }
}

function enterWorkbench(project: I18nProject) {
  if (project.languages && project.languages.length > 0) {
    sessionStorage.setItem(`project_langs_${project.id}`, JSON.stringify(project.languages))
  }
  router.push(`/workbench?project=${project.id}`)
}

onMounted(loadProjects)
</script>

<template>
  <div class="h-full p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">翻译项目</h1>
        <p class="text-sm text-muted-foreground mt-1">管理你所有的多语言翻译项目</p>
      </div>
      <UiButton @click="openCreate">
        <Plus class="size-4 mr-2" />
        新建项目
      </UiButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="projects.length === 0"
      class="flex flex-col items-center justify-center border border-dashed rounded-xl py-24 text-muted-foreground gap-3"
    >
      <Folder class="size-12 opacity-30" />
      <p class="text-sm">还没有翻译项目，点击右上角新建一个吧</p>
    </div>

    <!-- Project grid -->
    <div v-else class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="project in projects"
        :key="project.id"
        class="group relative flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
        @click="enterWorkbench(project)"
      >
        <!-- Color stripe -->
        <div class="h-1.5 bg-gradient-to-r from-primary to-primary/50" />

        <div class="p-5 flex flex-col gap-3 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Folder class="size-4 text-primary" />
              </div>
              <div>
                <h3 class="font-semibold leading-tight text-sm">{{ project.name }}</h3>
                <code class="text-[11px] text-muted-foreground">{{ project.code }}</code>
              </div>
            </div>
          </div>

          <p class="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {{ project.description || '暂无描述' }}
          </p>
        </div>

        <!-- Footer -->
        <div class="px-5 pb-4 flex items-center justify-between">
          <span class="text-[11px] text-muted-foreground">
            {{ new Date(project.updated_at).toLocaleDateString('zh-CN') }}
          </span>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <UiButton
              size="icon"
              variant="ghost"
              class="size-7"
              @click.stop="openEdit(project)"
            >
              <Pencil class="size-3.5" />
            </UiButton>
            <UiButton
              size="icon"
              variant="ghost"
              class="size-7 text-destructive hover:text-destructive"
              @click.stop="confirmDelete(project)"
            >
              <Trash2 class="size-3.5" />
            </UiButton>
            <UiButton
              size="icon"
              variant="ghost"
              class="size-7"
              @click.stop="enterWorkbench(project)"
            >
              <ArrowRight class="size-3.5" />
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    <UiDialog v-model:open="showDialog">
      <UiDialogContent class="sm:max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>{{ isEditing ? '编辑项目' : '新建翻译项目' }}</UiDialogTitle>
          <UiDialogDescription>
            {{ isEditing ? '修改项目信息后保存' : '填写新项目的基本信息' }}
          </UiDialogDescription>
        </UiDialogHeader>
        <div class="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          <div class="grid gap-2">
            <UiLabel>项目名称 *</UiLabel>
            <UiInput v-model="formData.name" placeholder="如：Nexus 后端" />
          </div>
          <div class="grid gap-2">
            <UiLabel>项目标识符 (Code) *</UiLabel>
            <UiInput
              v-model="formData.code"
              :disabled="isEditing"
              placeholder="如：nexus-backend（创建后不可修改）"
              class="font-mono"
            />
          </div>
          <div class="grid gap-2">
            <UiLabel>描述</UiLabel>
            <UiTextarea v-model="formData.description" placeholder="简单描述一下这个项目是做什么的..." rows="2" />
          </div>
          <div class="grid gap-2">
            <div class="flex items-center justify-between">
              <UiLabel>目标语言 * <span class="text-muted-foreground font-normal text-xs ml-1">（已选 {{ selectedLangCodes.length }} 种）</span></UiLabel>
              <div class="flex items-center gap-2">
                <button type="button" @click="selectedLangCodes = ALL_LANGUAGES.map(l => l.code)" class="text-[10px] text-primary hover:underline">全选</button>
                <span class="text-[10px] text-muted-foreground opacity-30">|</span>
                <button type="button" @click="selectedLangCodes = []" class="text-[10px] text-muted-foreground hover:text-primary hover:underline">清空</button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-1.5 p-3 border rounded-lg bg-muted/30">
              <label
                v-for="lang in ALL_LANGUAGES"
                :key="lang.code"
                class="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                :class="{ 'bg-primary/10 text-primary font-medium': selectedLangCodes.includes(lang.code) }"
                @click="toggleLang(lang.code)"
              >
                <div
                  class="size-3.5 rounded border shrink-0 flex items-center justify-center transition-colors"
                  :class="selectedLangCodes.includes(lang.code) ? 'bg-primary border-primary' : 'border-muted-foreground/40'"
                >
                  <svg v-if="selectedLangCodes.includes(lang.code)" class="size-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="truncate">{{ lang.name }}</span>
                <code class="text-[10px] text-muted-foreground ml-auto shrink-0">{{ lang.code }}</code>
              </label>
            </div>
          </div>
        </div>
        <UiDialogFooter>
          <UiButton variant="outline" @click="showDialog = false">取消</UiButton>
          <UiButton :disabled="submitting" @click="submitForm">
            <Loader2 v-if="submitting" class="size-4 mr-2 animate-spin" />
            {{ isEditing ? '保存' : '创建' }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Delete Confirm -->
    <UiAlertDialog v-model:open="showDeleteDialog">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>确认删除？</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            你确定要删除项目 <strong>「{{ deletingProject?.name }}」</strong> 吗？此操作不可撤销，项目下所有词条将一并删除。
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel>取消</UiAlertDialogCancel>
          <UiAlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="doDelete"
          >
            确认删除
          </UiAlertDialogAction>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </div>
</template>
