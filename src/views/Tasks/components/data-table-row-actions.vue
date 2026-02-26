<script setup lang="ts">
import type { Row } from '@tanstack/vue-table'
import type { Component } from 'vue'

import type { Task } from '../data/schema'

import { Ellipsis, FilePenLine, Trash2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useModal } from '@/composables/use-modal'
import { labels } from '../data/data'
import { taskSchema } from '../data/schema'

const props = defineProps<DataTableRowActionsProps>()

interface DataTableRowActionsProps {
  row: Row<Task>
}
const task = computed(() => taskSchema.parse(props.row.original))

const taskLabel = ref(task.value.label)

const showComponent = shallowRef<Component | null>(null)

type TCommand = 'edit' | 'create' | 'delete'
function handleSelect(command: TCommand) {
  switch (command) {
    case 'edit':
      showComponent.value = defineAsyncComponent(() => import('./task-resource-dialog.vue'))
      break
    case 'create':
      showComponent.value = defineAsyncComponent(() => import('./task-resource-dialog.vue'))
      break
    case 'delete':
      showComponent.value = defineAsyncComponent(() => import('./task-delete.vue'))
      break
  }
}

const isOpen = ref(false)
const { Modal, contentClass } = useModal()
</script>

<template>
  <component :is="Modal.Root" v-model:open="isOpen">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          class="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <Ellipsis class="size-4" />
          <span class="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-[160px]">
        <component :is="Modal.Trigger" as-child>
          <DropdownMenuItem @select.stop="handleSelect('edit')">
            <span>Edit</span>
            <DropdownMenuShortcut> <FilePenLine class="size-4" /> </DropdownMenuShortcut>
          </DropdownMenuItem>
        </component>

        <DropdownMenuItem disabled>
          Make a copy
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          Favorite
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Labels</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup v-model="taskLabel">
              <DropdownMenuRadioItem v-for="label in labels" :key="label.value" :value="label.value">
                {{ label.label }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <component :is="Modal.Trigger" as-child>
          <DropdownMenuItem @select.stop="handleSelect('delete')">
            <span>Delete</span>
            <DropdownMenuShortcut> <Trash2 class="size-4" /> </DropdownMenuShortcut>
          </DropdownMenuItem>
        </component>
      </DropdownMenuContent>
    </DropdownMenu>

    <component :is="Modal.Content" :class="contentClass">
      <component :is="showComponent" :task="task" @close="isOpen = false" />
    </component>
  </component>
</template>
