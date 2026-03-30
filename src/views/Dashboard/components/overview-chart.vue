<script setup lang="ts">
const chartData = [
  { label: 'Mon', value: 42 },
  { label: 'Tue', value: 58 },
  { label: 'Wed', value: 73 },
  { label: 'Thu', value: 61 },
  { label: 'Fri', value: 85 },
  { label: 'Sat', value: 49 },
  { label: 'Sun', value: 66 },
]

const maxValue = Math.max(...chartData.map(item => item.value))
</script>

<template>
  <UiCard class="pt-0">
    <UiCardHeader class="border-b py-5">
      <UiCardTitle>Weekly Progress</UiCardTitle>
      <UiCardDescription>
        Sample activity trend for the current dashboard module.
      </UiCardDescription>
    </UiCardHeader>
    <UiCardContent class="space-y-4 px-4 pb-4 pt-6 sm:px-6">
      <div class="flex h-56 items-end gap-3">
        <div
          v-for="item in chartData"
          :key="item.label"
          class="flex flex-1 flex-col items-center gap-2"
        >
          <div class="flex h-full w-full items-end">
            <div
              class="w-full rounded-t-md bg-primary/80 transition-all"
              :style="{ height: `${Math.round((item.value / maxValue) * 100)}%` }"
            />
          </div>
          <div class="text-xs text-muted-foreground">
            {{ item.label }}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between text-sm text-muted-foreground">
        <span>Peak: {{ maxValue }}</span>
        <span>Avg: {{ Math.round(chartData.reduce((sum, item) => sum + item.value, 0) / chartData.length) }}</span>
      </div>
    </UiCardContent>
  </UiCard>
</template>
