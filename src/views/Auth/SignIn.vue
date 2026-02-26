<script setup lang="ts">
import AuthTitle from './components/AuthTitle.vue'
import LoginForm from './components/LoginForm.vue'
</script>

<template>
  <div class="flex items-center justify-center min-h-screen p-4 min-w-screen">
    <main class="flex flex-col gap-4">
      <AuthTitle />
      <LoginForm />
    </main>
  </div>
</template>
