<script lang="ts" setup>
import type { Task } from '../data/schema'
import type { TaskValidator } from '../validators/task.validator'
import { toTypedSchema } from '@vee-validate/zod'

import { useForm } from 'vee-validate'

import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SidebarGroup } from '@/components/ui/sidebar'
import { labels, priorities, statuses } from '../data/data'
import { taskValidator } from '../validators/task.validator'

const props = defineProps<{
  task: Task | null
}>()
const emits = defineEmits(['close'])

const formSchema = toTypedSchema(taskValidator)

const initialValues = reactive<TaskValidator>({
  title: props.task ? props.task.title : '',
  status: props.task ? props.task.status : 'backlog',
  label: props.task ? props.task.label : 'feature',
  priority: props.task ? props.task.priority : 'medium',
})

const { isFieldDirty, handleSubmit } = useForm({
  validationSchema: formSchema,
  initialValues,
})
const onSubmit = handleSubmit((values) => {
  toast('You submitted the following values:', {
    description: h('pre', { class: 'mt-2 w-[340px] rounded-md bg-slate-950 p-4' }, h('code', { class: 'text-white' }, JSON.stringify(values, null, 2))),
  })
  emits('close')
})
</script>

<template>
  <div>
    <form class="w-2/3 space-y-6" @submit="onSubmit">
      <FormField v-slot="{ componentField }" name="title" :validate-on-blur="!isFieldDirty">
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input type="text" placeholder="shadcn" v-bind="componentField" />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField }" name="status" :validate-on-blur="!isFieldDirty">
        <FormItem>
          <FormLabel>status</FormLabel>
          <FormControl>
            <Select v-bind="componentField">
              <SelectTrigger class="w-[180px]">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SidebarGroup>
                  <SelectItem v-for="status in statuses" :key="status.value" :value="status.value">
                    <div class="flex items-center gap-2">
                      <component :is="status.icon" class="size-4 shrink-0" />
                      {{ status.label }}
                    </div>
                  </SelectItem>
                </SidebarGroup>
              </SelectContent>
            </Select>
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField }" name="label" :validate-on-blur="!isFieldDirty">
        <FormItem>
          <FormLabel>label</FormLabel>
          <FormControl>
            <RadioGroup
              class="flex flex-col space-y-1"
              v-bind="componentField"
            >
              <FormItem
                v-for="label in labels" :key="label.value"
                class="flex items-center space-y-0 gap-x-3"
              >
                <FormControl>
                  <RadioGroupItem :value="label.value" />
                </FormControl>
                <FormLabel class="font-normal">
                  {{ label.label }}
                </FormLabel>
              </FormItem>
            </RadioGroup>
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField }" name="priority" :validate-on-blur="!isFieldDirty">
        <FormItem>
          <FormLabel>priority</FormLabel>
          <FormControl>
            <RadioGroup
              class="flex flex-col space-y-1"
              v-bind="componentField"
            >
              <FormItem
                v-for="priority in priorities" :key="priority.value"
                class="flex items-center space-y-0 gap-x-3"
              >
                <FormControl>
                  <RadioGroupItem :value="priority.value" />
                </FormControl>
                <FormLabel class="font-normal">
                  {{ priority.label }}
                </FormLabel>
              </FormItem>
            </RadioGroup>
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>

      <Button type="submit">
        Submit
      </Button>
    </form>
  </div>
</template>
