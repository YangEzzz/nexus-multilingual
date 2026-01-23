import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestConfig
} from 'axios'
import axios from 'axios'
import qs from 'qs'
import { ResultEnum } from '@/request/types.ts'
import { getToken, removeToken } from '@/utils/auth'
import router from '@/router'
// import router from '@/router'

// 定义响应数据类型
export interface ResponseData<T = unknown> {
  code: number
  data: T
  message: string
}

// 创建 axios 实例
const request = axios.create({
  // API 请求的默认前缀
  baseURL: import.meta.env.VITE_APP_API_BASE_URL,
  timeout: 600000, // 请求超时时间
  adapter: 'fetch'
})

export type RequestError = AxiosError<{
  message?: string
  result?: unknown
  errorMessage?: string
}>

// 异常拦截处理器
function errorHandler(error: RequestError): Promise<never> {
  const status = error.response?.status
  const errorMessage = error.response?.data?.errorMessage || error.message || '请求错误'

  // 根据状态码处理特定错误
  switch (status) {
    case 401:
      // 未授权，可以跳转到登录页
      removeToken()
      router.push('/login')
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
function requestHandler(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig> {
  const data = config.data || false

  // 添加token到请求头
  const token = getToken()
  if (token) {
    ;(config.headers as AxiosRequestHeaders)['Authorization'] = `Bearer ${token}`
  }

  if (
    config.method?.toUpperCase() === 'POST' &&
    (config.headers as AxiosRequestHeaders)['Content-Type'] === 'application/x-www-form-urlencoded'
  ) {
    config.data = qs.stringify(data)
  }
  return config
}

// 添加请求拦截器
request.interceptors.request.use(requestHandler, errorHandler)

// 响应拦截器
function responseHandler(response: AxiosResponse) {
  const { data } = response
  if (!data) {
    throw new Error('请求没有返回值')
  }

  // 未设置状态码则默认成功状态
  const code = data.code || 200

  // 二进制数据则直接返回
  if (response.request.responseType === 'blob' || response.request.responseType === 'arraybuffer') {
    return response
  }

  if (code !== ResultEnum.SUCCESS) {
    throw new Error(data.message || '请求失败')
  } else {
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

  stream: (option: AxiosRequestConfig): Promise<ReadableStream<Uint8Array> | null> => {
    return request({
      method: 'POST',
      responseType: 'stream',
      ...option
    }).then((response) => {
      if (response instanceof Response) {
        return response.body
      }
      return null
    })
  },

  delete: <T>(option: AxiosRequestConfig): Promise<ResponseData<T>> => {
    return request({ method: 'DELETE', ...option })
  },

  put: <T>(option: AxiosRequestConfig): Promise<ResponseData<T>> => {
    return request({ method: 'PUT', ...option })
  },

  download: (option: AxiosRequestConfig): Promise<Blob> => {
    return request({
      method: 'GET',
      responseType: 'blob',
      ...option
    })
  },

  upload: <T>(option: UploadRequestConfig): Promise<ResponseData<T>> => {
    return request({
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      ...option
    })
  }
}

// 请求重试函数
export async function retryRequest<T>(requestFn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let retries = 0

  const execute = async (): Promise<T> => {
    try {
      return await requestFn()
    } catch (error) {
      if (retries < maxRetries) {
        retries++
        console.log(`请求失败，第${retries}次重试...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return execute()
      }
      throw error
    }
  }

  return execute()
}

export default request
