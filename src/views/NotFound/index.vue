<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  router.go(-1)
}

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/20 via-secondary/10 to-accent/20"
  >
    <div class="text-center">
      <div class="flex flex-col items-center">
        <div class="text-9xl font-extrabold text-primary">404</div>
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">页面不存在</h1>
        <p class="mt-6 text-base leading-7 text-muted-foreground">抱歉，您要访问的页面不存在或已被移除</p>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <Button @click="goHome"> 返回首页 </Button>
          <Button variant="outline" @click="goBack"> 返回上一页 </Button>
        </div>
      </div>
    </div>
  </div>
</template>
