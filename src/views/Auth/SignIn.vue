<script setup lang="ts">
import AuthTitle from './components/AuthTitle.vue'
import LoginForm from './components/LoginForm.vue'
</script>

<template>
  <div class="flex items-center justify-center min-h-screen p-4 min-w-screen bg-gray-50 dark:bg-zinc-950">
    <main class="flex w-full max-w-sm flex-col items-center gap-5">
      <AuthTitle />
      <LoginForm />
    </main>
  </div>
</template>
