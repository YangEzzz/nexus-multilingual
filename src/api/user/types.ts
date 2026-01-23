// 用户信息类型
export interface UserInfo {
  id: number
  name: string
  email: string
  role: {
    id: number
    name: string
  }
  createdAt: string
  updatedAt: string
}

// 角色信息类型
export interface RoleInfo {
  id: number
  name: string
  description: string
}

// 分页信息类型
export interface PaginationType {
  current: number
  pageSize: number
  total: number
}

// 用户列表响应类型
export interface UserListResponse {
  code: number
  message: string
  data: {
    list: UserInfo[]
    pagination: PaginationType
  } | null
}

// 用户信息响应类型
export interface UserInfoResponse {
  code: number
  message: string
  data: UserInfo | null
}

// 用户查询参数
export interface UserQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
}

// 更新用户角色参数
export interface UpdateUserRoleParams {
  userId: number
  roleId: number
}

// 接口响应类型
export type UserInfoResponse = ResponseData<UserInfo>
export type UserListResponse = ResponseData<{
  list: UserInfo[]
  pagination: PaginationType
}>
export type RoleListResponse = ResponseData<RoleInfo[]>
export type CommonResponse = ResponseData<{ success: boolean; message: string }>

// 通用响应数据类型
interface ResponseData<T> {
  code: number
  data: T
  message: string
}
