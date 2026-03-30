import type { AxiosError } from 'axios'

import axios from 'axios'

export function useAxios() {
  const env = import.meta.env
  const axiosInstance = axios.create({
    baseURL: `${env.VITE_APP_API_BASE_URL || ''}`,
    timeout: Number(env.VITE_SERVER_API_TIMEOUT) || 10000,
  })

  axiosInstance.interceptors.request.use((config) => {
    return config
  }, (error) => {
    return Promise.reject(error)
  })

  axiosInstance.interceptors.response.use((response) => {
    return response
  }, (error: AxiosError) => {
    // if status is not 2xx, throw error
    // you can handle error here
    return Promise.reject(error)
  })

  return {
    axiosInstance,
  }
}
