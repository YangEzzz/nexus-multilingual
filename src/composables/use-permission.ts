import type { PermissionRequirement } from '@/lib/permissions'
import { computed } from 'vue'
import { hasPermission, hasRoutePermission, normalizeRole } from '@/lib/permissions'
import { useAuthStore } from '@/store/auth'

export const usePermission = () => {
  const authStore = useAuthStore()
  const role = computed(() => normalizeRole(authStore.user?.role))
  const can = (requirement: PermissionRequirement, all = false) => hasPermission(role.value, requirement, all)
  const canVisit = (path: string) => hasRoutePermission(role.value, path)
  return { role, can, canVisit }
}
