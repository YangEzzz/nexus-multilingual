import { onScopeDispose, ref } from 'vue'

export function useDiscardConfirmation(isDirty: () => boolean) {
  const showDiscardDialog = ref(false)
  let pending: ((accepted: boolean) => void) | undefined
  function confirmDiscard(): Promise<boolean> {
    if (!isDirty())
      return Promise.resolve(true)
    pending?.(false)
    showDiscardDialog.value = true
    return new Promise((resolve) => {
      pending = resolve
    })
  }
  function resolveDiscard(accepted: boolean) {
    showDiscardDialog.value = false
    pending?.(accepted)
    pending = undefined
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (isDirty()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', beforeUnload)
  onScopeDispose(() => {
    window.removeEventListener('beforeunload', beforeUnload)
    resolveDiscard(false)
  })
  return { showDiscardDialog, confirmDiscard, resolveDiscard }
}
