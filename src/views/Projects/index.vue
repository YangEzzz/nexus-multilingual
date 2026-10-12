<script setup lang="ts">
import type { Project as I18nProject, ProjectLanguage } from '@/types/domain'
import { ArrowRight, CalendarDays, Folder, Languages, Loader2, Pencil, Plus, RefreshCcw, Search, Trash2, X } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { createProject, deleteProject, listProjects, updateProject, updateProjectLanguages } from '@/api/projects'
import { usePermission } from '@/composables/use-permission'
import { fetchAvailableLanguages } from '@/lib/available-languages'
import { errorMessage } from '@/lib/errors'

import { saveProjectConfiguration } from '@/lib/project-save'

defineOptions({ name: 'Projects' })

const router = useRouter()
const { can } = usePermission()
const projects = ref<I18nProject[]>([])
const loading = ref(true)
const loadError = ref('')
const availableLanguages = ref<ProjectLanguage[]>([])
const languagesLoading = ref(false)
const languagesError = ref('')
const searchQuery = ref('')

// Dialog state
const showDialog = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const formError = ref('')
const formData = ref({ id: 0, name: '', code: '', description: '' })
const selectedLangCodes = ref<string[]>([])

// Delete dialog
const showDeleteDialog = ref(false)
const deletingProject = ref<I18nProject | null>(null)
const deleting = ref(false)

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return projects.value

  return projects.value.filter(project => [project.name, project.code, project.description].some(value => value?.toLowerCase().includes(query)))
})

const configuredLanguageCount = computed(() => {
  return new Set(projects.value.flatMap(project => project.languages?.map(language => language.code) || [])).size
})

function formatUpdatedAt(value: string) {
  if (!value)
    return '暂无更新'

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

async function loadProjects() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listProjects<I18nProject[]>()
    projects.value = res.data ?? []
  }
  catch (e: unknown) {
    loadError.value = errorMessage(e) || '暂时无法获取项目列表'
    toast.error('加载项目失败', { description: errorMessage(e) })
  }
  finally {
    loading.value = false
  }
}

async function loadAvailableLanguages() {
  languagesLoading.value = true
  languagesError.value = ''
  try {
    availableLanguages.value = await fetchAvailableLanguages()
  }
  catch (e: unknown) {
    languagesError.value = errorMessage(e) || '无法获取可选语言'
  }
  finally {
    languagesLoading.value = false
  }
}

function toggleLang(code: string) {
  const idx = selectedLangCodes.value.indexOf(code)
  if (idx === -1)
    selectedLangCodes.value.push(code)
  else
    selectedLangCodes.value.splice(idx, 1)
}

function openCreate() {
  if (!can('project.create'))
    return
  isEditing.value = false
  formError.value = ''
  formData.value = { id: 0, name: '', code: '', description: '' }
  selectedLangCodes.value = availableLanguages.value.map(lang => lang.code)
  showDialog.value = true
}

function openEdit(project: I18nProject) {
  if (!can('project.edit'))
    return
  isEditing.value = true
  formError.value = ''
  formData.value = { id: project.id, name: project.name, code: project.code, description: project.description }
  selectedLangCodes.value = (project.languages || []).map(l => l.code)
  showDialog.value = true
}

function confirmDelete(project: I18nProject) {
  if (!can('project.delete'))
    return
  deletingProject.value = project
  showDeleteDialog.value = true
}

async function submitForm() {
  if (submitting.value)
    return
  if (!can(isEditing.value ? 'project.edit' : 'project.create'))
    return
  const name = formData.value.name.trim()
  const code = formData.value.code.trim()
  if (!name || !code) {
    formError.value = '请填写项目名称和标识符。'
    return
  }
  if (selectedLangCodes.value.length === 0) {
    formError.value = '请至少选择一种项目语言。'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    formData.value.name = name
    formData.value.code = code
    const languages = availableLanguages.value.filter(language => selectedLangCodes.value.includes(language.code))
    await saveProjectConfiguration(formData.value, languages, {
      create: async form => (await createProject<I18nProject>({ data: form })).data.id,
      update: async (form) => { await updateProject(form.id, { data: form }) },
      languages: async (id, selected) => { await updateProjectLanguages(id, { data: selected }) },
    })
    sessionStorage.removeItem(`project_langs_${formData.value.id}`)
    toast.success(isEditing.value ? '项目已更新' : '项目已创建')
    showDialog.value = false
    await loadProjects()
  }
  catch (e: unknown) {
    isEditing.value = Boolean(formData.value.id)
    formError.value = errorMessage(e, '保存失败，请检查后重试。')
    toast.error('操作失败', { description: errorMessage(e) })
  }
  finally {
    submitting.value = false
  }
}

async function doDelete() {
  if (!can('project.delete'))
    return
  if (!deletingProject.value || deleting.value)
    return
  deleting.value = true
  try {
    await deleteProject(deletingProject.value.id)
    toast.success('项目已删除')
    showDeleteDialog.value = false
    await loadProjects()
  }
  catch (e: unknown) {
    toast.error('删除失败', { description: errorMessage(e) })
  }
  finally {
    deleting.value = false
  }
}

function enterWorkbench(project: I18nProject) {
  router.push(`/workbench?project=${project.id}`)
}

onMounted(() => Promise.all([loadProjects(), loadAvailableLanguages()]))
</script>

<template>
  <div class="min-h-0 space-y-6 p-4 lg:p-6">
    <header class="flex flex-col gap-5 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-background to-background p-5 shadow-sm sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <div class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          <span class="size-1.5 rounded-full bg-primary" />
          项目空间
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          翻译项目
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          集中管理项目语言、词条内容和发布工作流，让每个翻译空间都有清晰的边界。
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-right">
          <div class="font-mono text-lg font-semibold text-foreground">
            {{ projects.length }}
          </div>
          <div class="text-[11px] text-muted-foreground">
            个项目
          </div>
        </div>
        <div class="rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-right">
          <div class="font-mono text-lg font-semibold text-foreground">
            {{ configuredLanguageCount }}
          </div>
          <div class="text-[11px] text-muted-foreground">
            种已配置语言
          </div>
        </div>
        <UiButton v-permission="'project.create'" class="rounded-xl" @click="openCreate">
          <Plus class="mr-2 size-4" />
          新建项目
        </UiButton>
      </div>
    </header>

    <section v-if="!loading && projects.length > 0" class="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4" aria-label="项目筛选">
      <div class="relative min-w-0 flex-1 sm:max-w-md">
        <label for="project-search" class="sr-only">搜索项目</label>
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <UiInput
          id="project-search"
          v-model="searchQuery"
          placeholder="搜索项目名称、标识符或描述"
          class="h-10 rounded-xl bg-background pl-9 pr-9"
        />
        <button v-if="searchQuery" type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="清除项目搜索" @click="searchQuery = ''">
          <X class="size-3.5" />
        </button>
      </div>
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="size-1.5 rounded-full bg-primary/60" />
        显示 {{ filteredProjects.length }} / {{ projects.length }} 个项目
      </div>
    </section>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-live="polite" aria-label="正在加载项目">
      <div v-for="index in 8" :key="index" class="overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <UiSkeleton class="size-10 rounded-xl" />
          <div class="min-w-0 flex-1 space-y-2">
            <UiSkeleton class="h-4 w-3/5" />
            <UiSkeleton class="h-3 w-2/5" />
          </div>
        </div>
        <div class="mt-5 space-y-2">
          <UiSkeleton class="h-3 w-full" />
          <UiSkeleton class="h-3 w-4/5" />
        </div>
        <div class="mt-6 flex items-center justify-between">
          <UiSkeleton class="h-3 w-20" />
          <UiSkeleton class="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>

    <div v-else-if="loadError" class="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border border-destructive/20 bg-destructive/[0.03] p-8 text-center" role="alert">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <RefreshCcw class="size-5" />
      </div>
      <div>
        <h2 class="text-base font-semibold text-foreground">
          项目列表加载失败
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ loadError }}
        </p>
      </div>
      <UiButton variant="outline" size="sm" @click="loadProjects">
        <RefreshCcw class="mr-2 size-4" />
        重新加载
      </UiButton>
    </div>

    <div v-else-if="projects.length === 0" class="flex min-h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center">
      <div class="flex size-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
        <Folder class="size-6" />
      </div>
      <div>
        <h2 class="text-lg font-semibold text-foreground">
          还没有翻译项目
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          创建第一个项目，开始组织语言和词条内容。
        </p>
      </div>
      <UiButton v-permission="'project.create'" variant="outline" @click="openCreate">
        <Plus class="mr-2 size-4" />
        创建第一个项目
      </UiButton>
    </div>

    <div v-else-if="filteredProjects.length === 0" class="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center">
      <Search class="size-8 text-muted-foreground/60" />
      <div>
        <h2 class="text-base font-semibold text-foreground">
          没有匹配的项目
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          换一个名称、标识符或描述关键词试试。
        </p>
      </div>
      <UiButton variant="ghost" size="sm" @click="searchQuery = ''">
        清除搜索
      </UiButton>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <article
        v-for="project in filteredProjects"
        :key="project.id"
        class="group flex min-h-64 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      >
        <div class="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/20" />

        <div class="flex flex-1 flex-col gap-4 p-5">
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <Folder class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-sm font-semibold text-foreground" :title="project.name">
                {{ project.name }}
              </h2>
              <code class="mt-1 block truncate font-mono text-[11px] text-muted-foreground" :title="project.code">{{ project.code }}</code>
            </div>
          </div>

          <p class="line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
            {{ project.description || '暂无描述，为项目补充背景与命名规范。' }}
          </p>

          <div class="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-1">
              <Languages class="size-3" />
              {{ project.languages?.length || 0 }} 种语言
            </span>
            <span class="inline-flex items-center gap-1">
              <CalendarDays class="size-3" />
              {{ formatUpdatedAt(project.updated_at) }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 border-t border-border/70 bg-muted/20 px-4 py-3">
          <UiButton class="min-w-0 flex-1 rounded-lg" size="sm" @click="enterWorkbench(project)">
            进入工作台
            <ArrowRight class="size-3.5" />
          </UiButton>
          <UiButton v-permission="'project.edit'" size="icon" variant="ghost" class="size-8" :aria-label="`编辑${project.name}`" :title="`编辑${project.name}`" @click="openEdit(project)">
            <Pencil class="size-3.5" />
          </UiButton>
          <UiButton v-permission="'project.delete'" size="icon" variant="ghost" class="size-8 text-destructive hover:text-destructive" :aria-label="`删除${project.name}`" :title="`删除${project.name}`" @click="confirmDelete(project)">
            <Trash2 class="size-3.5" />
          </UiButton>
        </div>
      </article>
    </div>

    <UiDialog v-model:open="showDialog">
      <UiDialogContent class="sm:max-w-lg">
        <form v-permission="isEditing ? 'project.edit' : 'project.create'" novalidate @submit.prevent="submitForm">
          <UiDialogHeader>
            <UiDialogTitle>{{ isEditing ? '编辑项目' : '新建翻译项目' }}</UiDialogTitle>
            <UiDialogDescription>
              {{ isEditing ? '更新项目资料和语言范围。' : '先确定项目边界，再开始录入和翻译词条。' }}
            </UiDialogDescription>
          </UiDialogHeader>
          <div class="max-h-[65vh] space-y-5 overflow-y-auto py-5 pr-1">
            <div class="grid gap-2">
              <UiLabel for="project-name">
                项目名称 <span class="text-destructive">*</span>
              </UiLabel>
              <UiInput id="project-name" v-model="formData.name" maxlength="255" placeholder="例如：Nexus 后端" :aria-invalid="Boolean(formError)" />
            </div>
            <div class="grid gap-2">
              <UiLabel for="project-code">
                项目标识符 <span class="text-destructive">*</span>
              </UiLabel>
              <UiInput
                id="project-code"
                v-model="formData.code"
                :disabled="isEditing"
                maxlength="100"
                placeholder="例如：nexus-backend"
                class="font-mono"
                :aria-invalid="Boolean(formError)"
              />
              <p class="text-xs text-muted-foreground">
                {{ isEditing ? '项目标识符创建后不可修改。' : '使用稳定、易识别的英文标识符。' }}
              </p>
            </div>
            <div class="grid gap-2">
              <UiLabel for="project-description">
                项目描述
              </UiLabel>
              <UiTextarea id="project-description" v-model="formData.description" maxlength="1000" placeholder="描述项目用途、上下文或命名规范..." rows="3" class="resize-none" />
            </div>
            <div class="grid gap-2">
              <div class="flex items-center justify-between gap-3">
                <UiLabel>项目语言 <span class="text-destructive">*</span> <span class="ml-1 text-xs font-normal text-muted-foreground">已选 {{ selectedLangCodes.length }} 种</span></UiLabel>
                <div class="flex shrink-0 items-center gap-2 text-xs">
                  <button type="button" class="font-medium text-primary underline-offset-4 hover:underline" @click="selectedLangCodes = availableLanguages.map(lang => lang.code)">
                    全选
                  </button>
                  <span class="text-muted-foreground/40">|</span>
                  <button type="button" class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" @click="selectedLangCodes = []">
                    清空
                  </button>
                </div>
              </div>
              <div v-if="languagesLoading" class="flex min-h-28 items-center justify-center rounded-xl border border-border/70 bg-muted/20" role="status" aria-live="polite">
                <Loader2 class="mr-2 size-5 animate-spin text-primary" />
                <span class="text-sm text-muted-foreground">正在加载可选语言</span>
              </div>
              <div v-else-if="languagesError" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
                <p>{{ languagesError }}</p>
                <UiButton type="button" variant="outline" size="sm" class="mt-3" @click="loadAvailableLanguages">
                  重新加载语言
                </UiButton>
              </div>
              <div v-else-if="availableLanguages.length === 0" class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                还没有可选语言，请先到“可选语言”页面添加。
              </div>
              <div v-else class="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-3" role="group" aria-label="选择项目语言">
                <button
                  v-for="lang in availableLanguages"
                  :key="lang.code"
                  type="button"
                  class="flex min-w-0 items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors hover:bg-background hover:shadow-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  :class="selectedLangCodes.includes(lang.code) ? 'border-primary/20 bg-primary/10 font-medium text-primary' : 'text-foreground'"
                  :aria-pressed="selectedLangCodes.includes(lang.code)"
                  @click="toggleLang(lang.code)"
                >
                  <span class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors" :class="selectedLangCodes.includes(lang.code) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background'">
                    <svg v-if="selectedLangCodes.includes(lang.code)" class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span class="min-w-0 truncate">{{ lang.name }}</span>
                  <code class="ml-auto shrink-0 text-[10px] text-muted-foreground">{{ lang.code }}</code>
                </button>
              </div>
            </div>
            <p v-if="formError" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {{ formError }}
            </p>
          </div>
          <UiDialogFooter>
            <UiButton type="button" variant="outline" :disabled="submitting" @click="showDialog = false">
              取消
            </UiButton>
            <UiButton type="submit" :disabled="submitting || languagesLoading || availableLanguages.length === 0">
              <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
              {{ submitting ? (isEditing ? '正在保存' : '正在创建') : (isEditing ? '保存项目' : '创建项目') }}
            </UiButton>
          </UiDialogFooter>
        </form>
      </UiDialogContent>
    </UiDialog>

    <UiAlertDialog v-model:open="showDeleteDialog">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>删除这个项目？</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            项目 <strong>「{{ deletingProject?.name }}」</strong> 及其语言、词条、翻译和历史记录将一并永久删除，此操作不可撤销。
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel :disabled="deleting">
            取消
          </UiAlertDialogCancel>
          <UiButton
            v-permission="'project.delete'"
            type="button"
            :disabled="deleting"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="doDelete"
          >
            <Loader2 v-if="deleting" class="mr-2 size-4 animate-spin" />
            {{ deleting ? '正在删除' : '永久删除项目' }}
          </UiButton>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </div>
</template>
