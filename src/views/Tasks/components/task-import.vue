<script lang="ts" setup>
import { Download } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useModal } from '@/composables/use-modal'

const isOpen = ref(false)
const file = ref()
const error = ref()

watch(file, () => {
  error.value = null
})
watch(isOpen, () => {
  file.value = null
})

function onSubmit() {
  error.value = null

  if (!file.value) {
    error.value = 'File is required'
    return
  }

  toast('You submitted the following values:', {
    description: h('pre', { class: 'mt-2 w-[340px] rounded-md bg-slate-950 p-4' }, h('code', { class: 'text-white' }, JSON.stringify(file.value, null, 2))),
  })
  isOpen.value = false
}

const { Modal, contentClass } = useModal()
</script>

<template>
  <component :is="Modal.Root" v-model:open="isOpen">
    <component :is="Modal.Trigger" as-child>
      <Button variant="outline">
        Import
        <Download />
      </Button>
    </component>

    <component :is="Modal.Content" :class="contentClass">
      <component :is="Modal.Header">
        <component :is="Modal.Title">
          Import Tasks
        </component>
        <component :is="Modal.Description">
          Import tasks quickly from a CSV file.
        </component>
      </component>

      <div class="grid w-full max-w-sm items-center gap-1.5">
        <Label>File</Label>
        <Input id="file" v-model="file" type="file" />
        <span v-if="error" class="text-destructive">{{ error }}</span>
      </div>

      <component :is="Modal.Footer">
        <Button variant="secondary" @click="isOpen = false">
          Cancel
        </Button>
        <Button @click="onSubmit">
          Import
        </Button>
      </component>
    </component>
  </component>
</template>
