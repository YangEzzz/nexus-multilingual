<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'

// #app owns page scrolling; body locking only isolates the portaled overlay.
// Do not add a second scrollbar allowance around the application viewport.
const scrollBody = { padding: 0, margin: 0 }
</script>

<template>
  <ConfigProvider :scroll-body="scrollBody">
    <slot />
  </ConfigProvider>
</template>
