<script setup lang="ts">
import { CircleAlert, Eye, EyeOff, KeyRound, Loader2, Server, ShieldCheck, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { deleteAISettings, getAISettings, saveAISettings } from '@/api/ai'
import { usePermission } from '@/composables/use-permission'

defineOptions({ name: 'AiSettings' })
const { can } = usePermission()

interface AISettings {
  configured: boolean
  model: string
  masked_key?: string
  key_last_four?: string
  relay_base_url: string
  updated_at?: string
}

const settings = ref<AISettings | null>(null)
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const showKey = ref(false)
const apiKey = ref('')
const model = ref('')
const formError = ref('')

const relayBaseURL = computed(() => settings.value?.relay_base_url || 'https://43.172.5.210:3000/v1')
const configured = computed(() => settings.value?.configured === true)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function loadSettings() {
  if (!can('ai.settings'))
    return
  loading.value = true
  try {
    const response = await getAISettings<AISettings>()
    settings.value = response.data
    model.value = response.data.model || ''
  }
  catch (error) {
    formError.value = errorMessage(error, '无法加载 AI 翻译设置。')
  }
  finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!can('ai.settings'))
    return
  formError.value = ''
  if (!model.value.trim()) {
    formError.value = '请输入模型名称。'
    return
  }
  if (!configured.value && !apiKey.value.trim()) {
    formError.value = '首次配置时请输入 API Key。'
    return
  }

  saving.value = true
  try {
    const response = await saveAISettings<AISettings>({

      data: { api_key: apiKey.value.trim(), model: model.value.trim() },
    })
    settings.value = response.data
    model.value = response.data.model
    apiKey.value = ''
    showKey.value = false
    toast.success('AI 翻译设置已保存')
  }
  catch (error) {
    formError.value = errorMessage(error, '保存 AI 翻译设置失败。')
  }
  finally {
    saving.value = false
  }
}

async function deleteSettings() {
  if (!can('ai.settings'))
    return
  deleting.value = true
  try {
    await deleteAISettings()
    settings.value = { configured: false, model: '', relay_base_url: relayBaseURL.value }
    apiKey.value = ''
    model.value = ''
    toast.success('已删除 AI 翻译设置')
  }
  catch (error) {
    formError.value = errorMessage(error, '删除 AI 翻译设置失败。')
  }
  finally {
    deleting.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <main v-permission="'ai.settings'" class="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
    <div class="mb-7 space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">
          AI 翻译设置
        </h1>
        <UiBadge :variant="configured ? 'secondary' : 'outline'" class="gap-1.5">
          <ShieldCheck v-if="configured" class="size-3" />
          {{ configured ? `已配置 ${settings?.masked_key || ''}` : '未配置' }}
        </UiBadge>
      </div>
      <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
        为当前账号配置用于翻译的 API Key 和模型。工作台会通过 Nexus 后端请求中转站，浏览器不会直连模型服务。
      </p>
    </div>

    <div v-if="loading" class="flex min-h-64 items-center justify-center rounded-xl border border-border bg-card">
      <Loader2 class="size-5 animate-spin text-muted-foreground" aria-label="正在加载设置" />
    </div>

    <div v-else class="grid gap-5">
      <UiAlert v-if="formError" variant="destructive" role="alert">
        <CircleAlert />
        <UiAlertTitle>无法完成操作</UiAlertTitle>
        <UiAlertDescription>{{ formError }}</UiAlertDescription>
      </UiAlert>

      <UiCard>
        <UiCardHeader class="border-b border-border/70">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <KeyRound class="size-4" />
            </div>
            <div>
              <UiCardTitle class="text-base">
                账号凭据
              </UiCardTitle>
              <UiCardDescription class="mt-1">
                Key 会以加密形式保存；更新模型时可不重复填写已有的 Key。
              </UiCardDescription>
            </div>
          </div>
        </UiCardHeader>
        <UiCardContent class="pt-6">
          <form class="grid max-w-2xl gap-5" novalidate @submit.prevent="saveSettings">
            <div class="grid gap-2">
              <label for="ai-model" class="text-sm font-medium text-foreground">模型名称</label>
              <UiInput id="ai-model" v-model="model" autocomplete="off" placeholder="例如：gpt-4o-mini" :aria-invalid="Boolean(formError && !model.trim())" aria-describedby="ai-model-hint" />
              <p id="ai-model-hint" class="text-xs leading-5 text-muted-foreground">
                填写中转站可用的完整模型标识。
              </p>
            </div>

            <div class="grid gap-2">
              <div class="flex items-center justify-between gap-3">
                <label for="ai-api-key" class="text-sm font-medium text-foreground">API Key</label>
                <span v-if="configured" class="text-xs text-muted-foreground">当前：{{ settings?.masked_key }}</span>
              </div>
              <div class="relative">
                <UiInput id="ai-api-key" v-model="apiKey" :type="showKey ? 'text' : 'password'" autocomplete="new-password" :placeholder="configured ? '留空则保留当前 Key' : '请输入 API Key'" class="pr-10" :aria-invalid="Boolean(formError && !configured && !apiKey.trim())" aria-describedby="ai-key-hint" />
                <UiButton type="button" variant="ghost" size="icon" class="absolute right-0 top-0 size-9 text-muted-foreground" :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'" @click="showKey = !showKey">
                  <EyeOff v-if="showKey" class="size-4" />
                  <Eye v-else class="size-4" />
                </UiButton>
              </div>
              <p id="ai-key-hint" class="text-xs leading-5 text-muted-foreground">
                Key 仅提交至 Nexus 后端，不会写入 localStorage 或发送给浏览器外的直连接口。
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3 pt-1">
              <UiButton type="submit" :disabled="saving">
                <Loader2 v-if="saving" class="size-4 animate-spin" />
                {{ saving ? '正在保存…' : '保存设置' }}
              </UiButton>
              <UiAlertDialog v-if="configured">
                <UiAlertDialogTrigger as-child>
                  <UiButton type="button" variant="outline" class="text-destructive hover:bg-destructive/10 hover:text-destructive" :disabled="deleting">
                    <Trash2 class="size-4" />
                    删除凭据
                  </UiButton>
                </UiAlertDialogTrigger>
                <UiAlertDialogContent>
                  <UiAlertDialogHeader>
                    <UiAlertDialogTitle>删除 AI 翻译凭据？</UiAlertDialogTitle>
                    <UiAlertDialogDescription>删除后，工作台的 AI 翻译将不可用，直到重新配置 Key 和模型。</UiAlertDialogDescription>
                  </UiAlertDialogHeader>
                  <UiAlertDialogFooter>
                    <UiAlertDialogCancel>取消</UiAlertDialogCancel>
                    <UiAlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" :disabled="deleting" @click="deleteSettings">
                      {{ deleting ? '正在删除…' : '确认删除' }}
                    </UiAlertDialogAction>
                  </UiAlertDialogFooter>
                </UiAlertDialogContent>
              </UiAlertDialog>
            </div>
          </form>
        </UiCardContent>
      </UiCard>

      <UiCard class="bg-muted/25">
        <UiCardContent class="flex items-start gap-3 py-5">
          <Server class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-foreground">
              固定中转站
            </p>
            <p class="mt-1 break-all font-mono text-xs leading-5 text-muted-foreground">
              {{ relayBaseURL }}
            </p>
            <p class="mt-1.5 text-xs leading-5 text-muted-foreground">
              地址由服务端统一管理，前端不提供修改入口。
            </p>
          </div>
        </UiCardContent>
      </UiCard>
    </div>
  </main>
</template>
