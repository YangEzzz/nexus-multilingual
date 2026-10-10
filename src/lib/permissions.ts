/** Helios 项目角色标识；产品沿用现有的 productor 拼写。 */
export const ROLES = {
  ADMIN: 'admin',
  PRODUCT: 'productor',
  DEVELOPER: 'developer',
  TRANSLATOR: 'translator',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

/** 前端功能权限。服务端仍须独立校验角色、项目范围及字段权限。 */
export const PERMISSIONS = {
  'project.create': [ROLES.ADMIN, ROLES.PRODUCT],
  'project.edit': [ROLES.ADMIN, ROLES.PRODUCT],
  'project.delete': [ROLES.ADMIN],
  'project.prompt': [ROLES.ADMIN, ROLES.PRODUCT],
  'language.manage': [ROLES.ADMIN],
  'ai.settings': [ROLES.ADMIN],
  'term.create': [ROLES.ADMIN, ROLES.DEVELOPER],
  'term.structure': [ROLES.ADMIN, ROLES.DEVELOPER],
  'term.description': [ROLES.ADMIN, ROLES.PRODUCT, ROLES.DEVELOPER],
  'term.translate': [ROLES.ADMIN, ROLES.PRODUCT, ROLES.TRANSLATOR],
  'term.edit': [ROLES.ADMIN, ROLES.PRODUCT, ROLES.DEVELOPER, ROLES.TRANSLATOR],
  'term.import': [ROLES.ADMIN, ROLES.DEVELOPER],
  'term.export': [ROLES.ADMIN, ROLES.PRODUCT, ROLES.DEVELOPER, ROLES.TRANSLATOR],
  'term.review': [ROLES.ADMIN, ROLES.PRODUCT],
  'term.publish': [ROLES.ADMIN, ROLES.PRODUCT],
  'term.delete': [ROLES.ADMIN, ROLES.DEVELOPER],
  'locale.publish': [ROLES.ADMIN],
  'logs.view': [ROLES.ADMIN, ROLES.PRODUCT, ROLES.DEVELOPER],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS
export type PermissionRequirement = Role | Permission | readonly (Role | Permission)[]

export const normalizeRole = (value: unknown): Role | null => {
  // 兼容既有 owner 账号，统一按管理员处理；不再通过本地用户 ID 提权。
  if (value === 'owner')
    return ROLES.ADMIN
  return Object.values(ROLES).includes(value as Role) ? value as Role : null
}

/** 数组默认任一满足；all=true 时要求全部满足。空值和未知标识拒绝访问。 */
export const hasPermission = (roleValue: unknown, requirement: PermissionRequirement, all = false): boolean => {
  const role = normalizeRole(roleValue)
  const requirements = Array.isArray(requirement) ? requirement : [requirement]
  if (!role || !requirements.length)
    return false
  const matches = (item: string) => {
    if (Object.values(ROLES).includes(item as Role))
      return role === item
    if (!Object.prototype.hasOwnProperty.call(PERMISSIONS, item))
      return false
    return (PERMISSIONS[item as Permission] as readonly Role[]).includes(role)
  }
  return all ? requirements.every(matches) : requirements.some(matches)
}

export const ROUTE_PERMISSIONS: Readonly<Record<string, Permission>> = {
  '/ai-settings': 'ai.settings',
  '/project-logs': 'logs.view',
}

/** 基础导航无需角色枚举匹配；只有明确配置的受限路由才检查权限。 */
export const hasRoutePermission = (roleValue: unknown, path: string): boolean => {
  const permission = ROUTE_PERMISSIONS[path]
  return !permission || hasPermission(roleValue, permission)
}
