const TOKEN_KEY = 'auth_token'

/**
 * 设置认证token
 * @param token 用户token
 */
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * 获取认证token
 * @returns 存储的token
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 移除token
 */
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 判断是否已登录
 * @returns 是否已登录
 */
export const isLoggedIn = (): boolean => {
  return !!getToken()
}
