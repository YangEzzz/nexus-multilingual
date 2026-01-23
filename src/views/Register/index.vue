<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { useDark, useToggle } from '@vueuse/core'
import { useRouter, useRoute } from 'vue-router'
import { register } from '@/api/login'
import { setToken } from '@/utils/auth'
import {toast} from "vue-sonner";

// 暗黑模式设置
const isDark = useDark()
const toggleDark = useToggle(isDark)

const router = useRouter()
const route = useRoute()
const isLoading = ref(false)
const errorMessage = ref('')

// 定义注册表单验证规则
const formSchema = toTypedSchema(
  z
    .object({
      email: z.string().email('请输入有效的邮箱地址'),
      name: z.string().min(2, '姓名至少需要2个字符'),
      password: z.string().min(6, '密码至少需要6个字符'),
      confirmPassword: z.string().min(6, '确认密码至少需要6个字符')
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: '两次输入的密码不一致',
      path: ['confirmPassword']
    })
)

// 初始化表单
const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    email: '',
    name: '',
    password: '',
    confirmPassword: ''
  }
})

// 处理注册提交
const onSubmit = form.handleSubmit(async (values) => {
  try {
    isLoading.value = true
    errorMessage.value = ''

    // 调用注册API
    const response = await register({
      email: values.email,
      name: values.name,
      password: values.password,
      confirmPassword: values.confirmPassword
    })

    if(response.code !== 200) {
      throw new Error(response.message)
    } else {
      toast.success(response.message, {
        duration: 2000,
        position: 'top-center'
      })
    }
  } catch (error) {
    // 处理错误
    errorMessage.value = error.message
    console.error('注册错误:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-secondary/60 via-secondary/80 to-accent/60 relative"
  >
    <!-- 暗黑模式切换按钮 -->
    <button
      class="absolute top-4 right-4 p-2 rounded-md bg-background text-foreground shadow-md transition-all"
      aria-label="切换暗黑模式"
      @click="toggleDark()"
    >
      <!-- 太阳图标 (亮色模式) -->
      <svg
        v-if="isDark"
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <!-- 月亮图标 (暗色模式) -->
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>

    <div class="max-w-md w-full bg-card text-card-foreground p-6 rounded-lg shadow-md transition-colors">
      <!-- 标题和图标 -->
      <div class="text-center">
        <div class="flex justify-center mb-3">
          <img src="/icon.png" alt="Logo" class="h-24 w-auto" />
        </div>
        <h2 class="mt-1 text-2xl font-extrabold">申请账号</h2>
        <p class="mt-1 text-sm text-muted-foreground mb-4">创建您的账户</p>
      </div>

      <!-- 错误信息 -->
      <div
        v-if="errorMessage"
        class="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 rounded-md text-sm mb-4"
      >
        {{ errorMessage }}
      </div>

      <!-- 注册表单 -->
      <form class="space-y-2" @submit.prevent="onSubmit">
        <!-- 邮箱输入 -->
        <FormField v-slot="{ field, errors }" name="email">
          <FormItem class="mb-1 relative pb-5">
            <FormControl>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="w-4 h-4 text-muted-foreground"
                  >
                    <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                    <path
                      d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z"
                    />
                  </svg>
                </div>
                <Input
                  type="email"
                  placeholder="请输入邮箱"
                  v-bind="field"
                  autocomplete="email"
                  class="w-full pl-9 pr-3 py-2 text-sm shadow-none bg-transparent"
                  :class="{ 'border-destructive': errors.length > 0 }"
                />
              </div>
            </FormControl>
            <div class="h-4 mt-1 overflow-visible absolute bottom-0">
              <FormMessage class="text-xs leading-none" />
            </div>
          </FormItem>
        </FormField>

        <!-- 姓名输入 -->
        <FormField v-slot="{ field, errors }" name="name">
          <FormItem class="mb-1 relative pb-5">
            <FormControl>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="w-4 h-4 text-muted-foreground"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.035-.687-.1-1.016A5 5 0 0010 11z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <Input
                  type="text"
                  placeholder="请输入姓名"
                  v-bind="field"
                  autocomplete="name"
                  class="w-full pl-9 pr-3 py-2 text-sm shadow-none bg-transparent"
                  :class="{ 'border-destructive': errors.length > 0 }"
                />
              </div>
            </FormControl>
            <div class="h-4 mt-1 overflow-visible absolute bottom-0">
              <FormMessage class="text-xs leading-none" />
            </div>
          </FormItem>
        </FormField>

        <!-- 密码输入 -->
        <FormField v-slot="{ field, errors }" name="password">
          <FormItem class="mb-1 relative pb-5">
            <FormControl>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="w-4 h-4 text-muted-foreground"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <Input
                  type="password"
                  placeholder="请输入密码"
                  v-bind="field"
                  autocomplete="new-password"
                  class="w-full pl-9 pr-3 py-2 text-sm shadow-none bg-transparent"
                  :class="{ 'border-destructive': errors.length > 0 }"
                />
              </div>
            </FormControl>
            <div class="h-4 mt-1 overflow-visible absolute bottom-0">
              <FormMessage class="text-xs leading-none" />
            </div>
          </FormItem>
        </FormField>

        <!-- 确认密码输入 -->
        <FormField v-slot="{ field, errors }" name="confirmPassword">
          <FormItem class="mb-1 relative pb-5">
            <FormControl>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="w-4 h-4 text-muted-foreground"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <Input
                  type="password"
                  placeholder="请再次输入密码"
                  v-bind="field"
                  autocomplete="new-password"
                  class="w-full pl-9 pr-3 py-2 text-sm shadow-none bg-transparent"
                  :class="{ 'border-destructive': errors.length > 0 }"
                />
              </div>
            </FormControl>
            <div class="h-4 mt-1 overflow-visible absolute bottom-0">
              <FormMessage class="text-xs leading-none" />
            </div>
          </FormItem>
        </FormField>

        <!-- 注册按钮 -->
        <div class="pt-3">
          <Button type="submit" :disabled="isLoading" class="w-full flex justify-center py-2 text-sm">
            <span v-if="isLoading" class="mr-2">
              <!-- 简单的加载指示器 -->
              <svg
                class="animate-spin -ml-1 mr-1 h-4 w-4 text-primary-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </span>
            {{ isLoading ? '注册中...' : '注册' }}
          </Button>
        </div>

        <!-- 返回登录 -->
        <div class="flex items-center justify-center pt-1">
          <div class="text-xs">
            <router-link to="/login" class="font-medium text-primary hover:text-primary/80">
              已有账号？返回登录
            </router-link>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* 覆盖默认样式，可以用Tailwind直接控制 */
</style>
