import request from '@/request'

/** Compatibility entry point using the canonical session-aware client. */
export function useAxios() {
  return { axiosInstance: request }
}
