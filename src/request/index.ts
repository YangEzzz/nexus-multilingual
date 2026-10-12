import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import axios from 'axios'
import qs from 'qs'
import { ResultEnum } from '@/request/types.ts'
import router from '@/router/index'
import { useAuthStore } from '@/store/auth'
import { apiBaseURL, clearLegacyAuth, getCSRFToken } from '@/utils/session'

// 定义响应数据类型
export interface ResponseData<T = unknown> {
  code: number
  data: T
  message: string
}

export interface DownloadData {
  blob: Blob
  filename?: string
}

// 创建 axios 实例
const request = axios.create({
  // API 请求的默认前缀
  baseURL: apiBaseURL,
  timeout: 600000, // 请求超时时间
  adapter: 'fetch',
  withCredentials: true,
})

export type RequestError = AxiosError<{
  message?: string
  result?: unknown
  errorMessage?: string
}>

// 异常拦截处理器
const errorHandler = (error: RequestError): Promise<never> => {
  const status = error.response?.status
  const errorMessage = error.response?.data?.errorMessage || error.message || '请求错误'

  // 根据状态码处理特定错误
  switch (status) {
    case 401:
      // 未授权，可以跳转到登录页
      clearLegacyAuth()
      useAuthStore().isLogin = false
      useAuthStore().user = null
      router.push({ path: '/auth/sign-in', query: { redirect: router.currentRoute.value.fullPath } })
      console.error('未授权，请重新登录')
      break
    case 403:
      console.error('拒绝访问')
      break
    case 404:
      console.error('请求的资源不存在')
      break
    case 500:
      console.error('服务器错误')
      break
    default:
      console.error(errorMessage)
  }

  return Promise.reject(error)
}

// 请求拦截器
const requestHandler = async (
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> => {
  const data = config.data || false

  // Cookie 会话的写请求需要 CSRF 校验。
  if (!['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase() || 'GET')) {
    ;(config.headers as AxiosRequestHeaders)['X-CSRF-Token'] = await getCSRFToken()
  }

  if (
    config.method?.toUpperCase() === 'POST'
    && (config.headers as AxiosRequestHeaders)['Content-Type'] === 'application/x-www-form-urlencoded'
  ) {
    config.data = qs.stringify(data)
  }
  return config
}

// 添加请求拦截器
request.interceptors.request.use(requestHandler, errorHandler)

// 响应拦截器
const responseHandler = (response: AxiosResponse) => {
  const { data } = response
  if (!data) {
    throw new Error('请求没有返回值')
  }

  // 未设置状态码则默认成功状态
  const code = data.code ?? 200

  // 二进制数据则直接返回
  if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
    return response
  }

  if (code !== ResultEnum.SUCCESS) {
    throw new Error(data.message || '请求失败')
  }
  else {
    return data
  }
}

// 添加响应拦截器
request.interceptors.response.use(responseHandler, errorHandler)

// 创建取消令牌
export const createCancelToken = axios.CancelToken.source

// 定义文件上传配置类型
interface UploadRequestConfig extends AxiosRequestConfig {
  headersType?: string
  data?: FormData | Record<string, unknown>
}

// API方法集合
export const api = {
  get: <T>(option: AxiosRequestConfig): Promise<ResponseData<T>> => {
    return request({ method: 'GET', ...option })
  },

  post: <T>(option: AxiosRequestConfig): Promise<ResponseData<T>> => {
    return request({ method: 'POST', ...option })
  },

  download: async (option: AxiosRequestConfig): Promise<Blob> => {
    const response = await request<Blob, AxiosResponse<Blob>>({
      method: 'GET',
      ...option,
      responseType: 'blob',
    })
    return response.data
  },

  downloadPost: async (option: AxiosRequestConfig): Promise<DownloadData> => {
    const response = await request({
      method: 'POST',
      responseType: 'blob',
      ...option,
    }) as unknown as AxiosResponse<Blob>

    const contentType = String(response.headers['content-type'] || '')
    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await response.data.text())
      throw new Error(payload.message || '文件生成失败')
    }

    const disposition = String(response.headers['content-disposition'] || '')
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i)
    return {
      blob: response.data,
      filename: filenameMatch?.[1],
    }
  },

  upload: <T>(option: UploadRequestConfig): Promise<ResponseData<T>> => {
    return request({
      method: 'POST',
      ...option,
    })
  },
}

// 请求重试函数
export const retryRequest = async <T>(requestFn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> => {
  let retries = 0

  const execute = async (): Promise<T> => {
    try {
      return await requestFn()
    }
    catch (error) {
      if (retries < maxRetries) {
        retries++
        console.warn(`请求失败，第${retries}次重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return execute()
      }
      throw error
    }
  }

  return execute()
}

export default request
