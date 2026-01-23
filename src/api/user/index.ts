import { api } from '@/request'
import type {
  UserInfo,
  UserListResponse,
  UserInfoResponse,
  UserQueryParams,
  RoleInfo,
  RoleListResponse,
  UpdateUserRoleParams,
  CommonResponse
} from './types'

/**
 * 获取当前用户信息
 * @returns 用户信息
 */
export const getUserInfo = async (): Promise<UserInfoResponse> => {
  return api.get<UserInfo>({
    url: '/user/info'
  })
}

/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 用户列表
 */
export const getUserList = async (params: UserQueryParams): Promise<UserListResponse> => {
  return api.get<{
    list: UserInfo[]
    pagination: {
      current: number
      pageSize: number
      total: number
    }
  }>({
    url: '/user/list',
    params
  })
}

/**
 * 获取所有角色列表
 * @returns 角色列表
 */
export const getRoleList = async (): Promise<RoleListResponse> => {
  return api.get<RoleInfo[]>({
    url: '/user/roleList'
  })
}

/**
 * 更新用户角色
 * @param params 更新参数
 * @returns 更新结果
 */
export const updateUserRole = async (params: UpdateUserRoleParams): Promise<CommonResponse> => {
  return api.post<{ success: boolean; message: string }>({
    url: '/user/update-role',
    data: params
  })
}

/**
 * 删除用户
 * @param id 用户ID
 * @returns 删除结果
 */
export const deleteUser = async (id: number): Promise<CommonResponse> => {
  return api.post<{
    success: boolean
    message: string
  }>({
    url: '/user/delete',
    data: { id }
  })
}
