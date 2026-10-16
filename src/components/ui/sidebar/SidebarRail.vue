<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { onBeforeUnmount, watch } from 'vue'
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '@/lib/sidebar-width'
import { cn } from '@/lib/utils'
import { useSidebar } from './utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { toggleSidebar, state, isMobile, width, setWidth, resizing } = useSidebar()
let drag: { target: HTMLElement, pointerId: number, x: number, width: number, direction: number, selection: string, cursor: string } | undefined

function stopDrag() {
  if (!drag)
    return
  const previous = drag
  drag = undefined
  if (previous.target.hasPointerCapture(previous.pointerId))
    previous.target.releasePointerCapture(previous.pointerId)
  document.body.style.userSelect = previous.selection
  document.body.style.cursor = previous.cursor
  resizing.value = false
}
function startDrag(event: PointerEvent) {
  if (state.value !== 'expanded' || isMobile.value || event.button !== 0 || drag)
    return
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  target.focus()
  drag = { target, pointerId: event.pointerId, x: event.clientX, width: width.value, direction: target.closest('[data-side]')?.getAttribute('data-side') === 'right' ? -1 : 1, selection: document.body.style.userSelect, cursor: document.body.style.cursor }
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  resizing.value = true
  event.preventDefault()
}
function moveDrag(event: PointerEvent) {
  if (drag && event.pointerId === drag.pointerId)
    setWidth(drag.width + (event.clientX - drag.x) * drag.direction)
}
function endDrag(event: PointerEvent) {
  if (drag?.pointerId === event.pointerId)
    stopDrag()
}
function keyResize(event: KeyboardEvent) {
  if (state.value !== 'expanded' || isMobile.value)
    return
  const direction = (event.currentTarget as HTMLElement).closest('[data-side]')?.getAttribute('data-side') === 'right' ? -1 : 1
  const step = event.shiftKey ? 20 : 10
  switch (event.key) {
    case 'ArrowLeft':
      setWidth(width.value - step * direction)
      break
    case 'ArrowRight':
      setWidth(width.value + step * direction)
      break
    case 'Home':
      setWidth(SIDEBAR_MIN_WIDTH)
      break
    case 'End':
      setWidth(SIDEBAR_MAX_WIDTH)
      break
    case 'Enter':
      setWidth(SIDEBAR_DEFAULT_WIDTH)
      break
    default: return
  }
  event.preventDefault()
}
watch([state, isMobile], stopDrag)
onBeforeUnmount(stopDrag)
</script>

<template>
  <component
    :is="state === 'expanded' ? 'div' : 'button'"
    data-sidebar="rail"
    data-slot="sidebar-rail"
    :role="state === 'expanded' ? 'separator' : undefined"
    :aria-label="state === 'expanded' ? '调整左侧菜单宽度' : '展开导航'"
    :aria-orientation="state === 'expanded' ? 'vertical' : undefined"
    :aria-valuemin="state === 'expanded' ? SIDEBAR_MIN_WIDTH : undefined"
    :aria-valuemax="state === 'expanded' ? SIDEBAR_MAX_WIDTH : undefined"
    :aria-valuenow="state === 'expanded' ? width : undefined"
    :aria-valuetext="state === 'expanded' ? `${width} 像素` : undefined"
    :tabindex="state === 'expanded' ? 0 : -1"
    :title="state === 'expanded' ? '拖动调整宽度；方向键微调，双击恢复默认' : '展开导航'"
    :class="cn(
      'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      props.class,
      state === 'expanded' && 'cursor-col-resize touch-none focus-visible:outline-none focus-visible:after:bg-sidebar-ring',
    )"
    @click="state === 'collapsed' && toggleSidebar()"
    @dblclick="state === 'expanded' && setWidth(SIDEBAR_DEFAULT_WIDTH)"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
    @keydown="keyResize"
  >
    <slot />
  </component>
</template>
