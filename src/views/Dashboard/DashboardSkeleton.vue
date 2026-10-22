<script setup lang="ts">
withDefaults(defineProps<{ showProjectList?: boolean }>(), { showProjectList: false })
</script>

<template>
  <div class="space-y-5" role="status" aria-live="polite" aria-busy="true" aria-label="正在加载仪表盘">
    <div v-if="showProjectList" class="flex gap-2">
      <UiSkeleton class="h-9 w-36" /><UiSkeleton class="h-9 w-40" />
    </div>
    <UiSkeleton class="h-16 w-full rounded-lg" />
    <div class="dashboard-metrics">
      <UiSkeleton v-for="index in 6" :key="index" class="h-32 rounded-lg" />
    </div>
    <div v-for="row in 2" :key="row" class="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div v-for="column in 2" :key="column" class="workspace-panel p-5">
        <UiSkeleton class="h-5 w-32" /><UiSkeleton class="mt-3 h-3 w-3/5" /><UiSkeleton class="mt-6 h-52 w-full" />
      </div>
    </div>
    <div class="workspace-panel p-5">
      <UiSkeleton class="h-5 w-24" /><UiSkeleton class="mt-4 h-16 w-full" />
    </div>
  </div>
</template>
