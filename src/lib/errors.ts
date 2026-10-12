export function errorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
  return error instanceof Error && error.message ? error.message : fallback
}
