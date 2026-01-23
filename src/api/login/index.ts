import { api } from '@/request'
import type {
  LoginRequestType,
  RegisterRequestType,
  LoginResponseType,
  RegisterResponseType
} from '@/api/login/types.ts'

/**
 * 用户登录
 * @param data 登录信息
 * @returns 登录结果
 */
export const login = async (data: LoginRequestType) => {
  return api.post<string>({
    url: '/login',
    data
  })
}

/**
 * 用户注册
 * @param data 注册信息
 * @returns 注册结果
 */
export const register = async (data: RegisterRequestType) => {
  return api.post<RegisterResponseType>({
    url: '/register',
    data
  })
}

/**
 * 退出登录
 */
export const logout = async () => {
  return api.post({
    url: '/logout'
  })
}
