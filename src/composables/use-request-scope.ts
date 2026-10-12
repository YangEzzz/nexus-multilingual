import { onScopeDispose } from 'vue'

/** Every response belongs to the context and generation in which it started. */
export function useRequestScope(getContext: () => string) {
  let generation = 0
  let disposed = false
  const controllers = new Set<AbortController>()
  function invalidate() {
    generation++
    controllers.forEach(controller => controller.abort())
    controllers.clear()
  }
  function capture() {
    const context = getContext()
    const version = generation
    return { context, isCurrent: () => !disposed && context === getContext() && version === generation }
  }
  function request() {
    const ticket = capture()
    const controller = new AbortController()
    controllers.add(controller)
    return { ...ticket, signal: controller.signal, release: () => controllers.delete(controller) }
  }
  onScopeDispose(() => {
    disposed = true
    invalidate()
  })
  return { capture, request, invalidate }
}
