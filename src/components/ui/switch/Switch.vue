<script setup lang="ts">
import { computed } from 'vue'
import { cva } from 'class-variance-authority'

const props = defineProps<{
  checked?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:checked': [value: boolean]
}>()

const toggle = () => {
  if (props.disabled) return
  emit('update:checked', !props.checked)
}

const switchVariants = cva(
  'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
  {
    variants: {
      variant: {
        default: 'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        destructive: 'data-[state=checked]:bg-destructive data-[state=unchecked]:bg-input'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

const thumbVariants = cva(
  'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
  {
    variants: {
      variant: {
        default: '',
        destructive: ''
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

const switchClass = computed(() => {
  return switchVariants({ variant: 'default' })
})

const thumbClass = computed(() => {
  return thumbVariants({ variant: 'default' })
})
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    :data-state="checked ? 'checked' : 'unchecked'"
    :disabled="disabled"
    @click="toggle"
    :class="switchClass"
  >
    <span :data-state="checked ? 'checked' : 'unchecked'" :class="thumbClass" />
  </button>
</template>
