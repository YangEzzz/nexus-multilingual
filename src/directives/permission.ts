import type { App, ObjectDirective } from 'vue'
import type { PermissionRequirement } from '@/lib/permissions'
import { shallowRef, watchEffect } from 'vue'
import { hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth'

/** 只应用在原生元素或具有单一元素根节点的组件上，不应用在 template/Teleport 上。 */
export const createPermissionDirective = (getRole: () => unknown): ObjectDirective<HTMLElement, PermissionRequirement> => {
  const states = new WeakMap<HTMLElement, {
    requirement: ReturnType<typeof shallowRef<PermissionRequirement>>
    all: ReturnType<typeof shallowRef<boolean>>
    sync: () => void
    stop: () => void
    block: (event: Event) => void
  }>()

  return {
    beforeMount(el, binding) {
      const requirement = shallowRef(binding.value)
      const all = shallowRef(Boolean(binding.modifiers.all))
      let denied = false
      let display = el.style.getPropertyValue('display')
      let priority = el.style.getPropertyPriority('display')
      const allowed = () => hasPermission(getRole(), requirement.value, all.value)
      const sync = () => {
        if (!allowed()) {
          if (!denied) {
            display = el.style.getPropertyValue('display')
            priority = el.style.getPropertyPriority('display')
          }
          denied = true
          el.style.setProperty('display', 'none', 'important')
        }
        else if (denied) {
          denied = false
          if (display)
            el.style.setProperty('display', display, priority)
          else
            el.style.removeProperty('display')
        }
      }
      const block = (event: Event) => {
        if (!allowed()) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      }
      // 保留节点以支持登录、角色变化和绑定更新；拒绝访问时也拦截合成事件。
      el.addEventListener('click', block, true)
      el.addEventListener('keydown', block, true)
      const stop = watchEffect(sync, { flush: 'sync' })
      states.set(el, { requirement, all, sync, stop, block })
    },
    updated(el, binding) {
      const state = states.get(el)
      if (!state)
        return
      state.requirement.value = binding.value
      state.all.value = Boolean(binding.modifiers.all)
      // Vue 可能更新 style 属性，更新后重新应用权限隐藏。
      state.sync()
    },
    beforeUnmount(el) {
      const state = states.get(el)
      state?.stop()
      if (state) {
        el.removeEventListener('click', state.block, true)
        el.removeEventListener('keydown', state.block, true)
      }
      states.delete(el)
    },
  }
}

export const setupPermission = (app: App) => {
  const authStore = useAuthStore()
  app.directive('permission', createPermissionDirective(() => authStore.user?.role))
}
