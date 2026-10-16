export const SIDEBAR_DEFAULT_WIDTH = 264
export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_MAX_WIDTH = 360
export const SIDEBAR_WIDTH_STORAGE_KEY = 'nexus-sidebar-width'

export function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value))
    return SIDEBAR_DEFAULT_WIDTH
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)))
}
