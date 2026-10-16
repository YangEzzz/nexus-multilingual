<script setup lang="ts">
withDefaults(defineProps<{
  showProjectList?: boolean
}>(), {
  showProjectList: false,
})
</script>

<template>
  <div
    class="space-y-6"
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label="正在加载仪表盘"
  >
    <div v-if="showProjectList" class="flex flex-wrap gap-2">
      <UiSkeleton class="h-9 w-24 rounded-full" />
      <UiSkeleton class="h-9 w-32 rounded-full" />
      <UiSkeleton class="h-9 w-28 rounded-full" />
    </div>

    <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section class="rounded-xl border border-border bg-card p-6">
        <div class="flex flex-col gap-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="w-full space-y-3">
              <UiSkeleton class="h-6 w-24 rounded-full" />
              <UiSkeleton class="h-8 w-56" />
              <UiSkeleton class="h-3 w-28" />
              <div class="space-y-2">
                <UiSkeleton class="h-3 w-full max-w-xl" />
                <UiSkeleton class="h-3 w-4/5 max-w-lg" />
              </div>
            </div>
            <div class="grid w-full gap-2 md:max-w-36">
              <UiSkeleton class="h-16 w-full rounded-xl" />
              <UiSkeleton class="h-16 w-full rounded-xl" />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <UiSkeleton class="h-24 rounded-xl" />
            <UiSkeleton class="h-24 rounded-xl" />
            <UiSkeleton class="h-24 rounded-xl" />
          </div>
        </div>
      </section>

      <section class="rounded-xl border bg-card p-6">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <UiSkeleton class="h-4 w-24" />
            <UiSkeleton class="h-3 w-52" />
          </div>
          <UiSkeleton class="size-4 rounded-full" />
        </div>
        <div class="mt-5 space-y-3">
          <UiSkeleton class="h-20 rounded-xl" />
          <UiSkeleton class="h-20 rounded-xl" />
          <div class="grid gap-3 sm:grid-cols-2">
            <UiSkeleton class="h-20 rounded-xl" />
            <UiSkeleton class="h-20 rounded-xl" />
          </div>
        </div>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section class="rounded-xl border bg-card p-6">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <UiSkeleton class="h-4 w-20" />
            <UiSkeleton class="h-3 w-64" />
          </div>
          <UiSkeleton class="size-4 rounded-full" />
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <UiSkeleton v-for="index in 4" :key="index" class="h-32 rounded-xl" />
        </div>
      </section>

      <section class="rounded-xl border bg-card p-6">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <UiSkeleton class="h-4 w-32" />
            <UiSkeleton class="h-3 w-48" />
          </div>
          <UiSkeleton class="h-3 w-16" />
        </div>
        <div class="mt-6 flex h-44 items-end gap-3">
          <UiSkeleton v-for="index in 7" :key="index" class="h-full flex-1 rounded-t-xl rounded-b-none" :style="{ height: `${35 + (index % 4) * 15}%` }" />
        </div>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
      <section class="flex min-h-0 flex-col rounded-xl border bg-card p-6 xl:h-[44rem]">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <UiSkeleton class="h-4 w-24" />
            <UiSkeleton class="h-3 w-64" />
          </div>
          <UiSkeleton class="h-3 w-20" />
        </div>
        <div class="mt-5 min-h-0 flex-1 space-y-4 overflow-hidden">
          <UiSkeleton v-for="index in 5" :key="index" class="h-24 rounded-xl" />
        </div>
      </section>

      <div class="flex min-h-0 flex-col gap-4 overflow-hidden xl:h-[44rem]">
        <section class="flex min-h-0 flex-1 flex-col rounded-xl border bg-card p-6">
          <div class="flex items-center justify-between">
            <div class="space-y-2">
              <UiSkeleton class="h-4 w-32" />
              <UiSkeleton class="h-3 w-48" />
            </div>
            <UiSkeleton class="size-4 rounded-full" />
          </div>
          <div class="mt-5 space-y-3">
            <UiSkeleton v-for="index in 3" :key="index" class="h-20 rounded-xl" />
          </div>
        </section>

        <section class="flex min-h-0 flex-1 flex-col rounded-xl border bg-card p-6">
          <div class="space-y-2">
            <UiSkeleton class="h-4 w-20" />
            <UiSkeleton class="h-3 w-56" />
          </div>
          <div class="mt-5 space-y-3">
            <UiSkeleton v-for="index in 3" :key="index" class="h-16 rounded-xl" />
          </div>
        </section>
      </div>
    </div>

    <section class="rounded-xl border bg-card p-6">
      <div class="flex items-center justify-between">
        <div class="space-y-2">
          <UiSkeleton class="h-4 w-20" />
          <UiSkeleton class="h-3 w-72" />
        </div>
        <UiSkeleton class="h-8 w-16 rounded-lg" />
      </div>
      <div class="mt-6 space-y-4">
        <UiSkeleton v-for="index in 3" :key="index" class="h-20 rounded-xl" />
      </div>
    </section>
  </div>
</template>
