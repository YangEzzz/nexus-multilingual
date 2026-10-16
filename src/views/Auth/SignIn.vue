<script setup lang="ts">
import { ArrowRight, Check, Languages } from 'lucide-vue-next'
import LoginForm from './components/LoginForm.vue'

document.title = '登录 · Nexus'
</script>

<template>
  <main class="grid min-h-svh bg-background lg:grid-cols-[1.05fr_1fr]">
    <section class="flex flex-col justify-between border-b bg-muted/60 px-6 py-8 sm:px-12 lg:border-b-0 lg:border-r lg:px-16 lg:py-12">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Languages class="size-5" /></span><span class="text-xl font-semibold tracking-tight">Nexus</span>
      </div>
      <div class="max-w-lg py-10 lg:py-16">
        <p class="section-kicker">
          多语言工作台
        </p>
        <h1 class="mt-5 text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
          每一种语言，<br>都在同一个工作空间。
        </h1>
        <p class="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
          集中管理软件词条，让录入、翻译、校对与发布衔接起来。
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span data-tone="info" class="detail-badge rounded-md border px-3 py-2">原文</span><ArrowRight class="size-3.5" /><span class="rounded-md border bg-card px-3 py-2">多语言译文</span><ArrowRight class="size-3.5" /><span data-tone="success" class="detail-badge flex items-center gap-1.5 rounded-md border px-3 py-2"><Check class="size-3.5" />校对与发布</span>
        </div>
      </div>
      <p class="hidden text-xs text-muted-foreground lg:block">
        Nexus Multilingual · 团队翻译与发布
      </p>
    </section>
    <section class="flex items-center justify-center px-6 py-12 sm:px-12">
      <div class="w-full max-w-md">
        <LoginForm /><p class="mt-6 text-center text-xs text-muted-foreground">
          账号和项目访问权限由 Helios 统一管理
        </p>
      </div>
    </section>
  </main>
</template>
