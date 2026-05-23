import axios, { type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '@/services/config'

export const ACCESS_TOKEN_KEY = 'merehbank_access_token'
export const USER_KEY = 'merehbank_user'

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

const baseURL = API_BASE_URL || undefined
const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

export const publicClient = axios.create({
  baseURL,
  headers: defaultHeaders,
  withCredentials: true,
})

export const apiClient = axios.create({
  baseURL,
  headers: defaultHeaders,
  withCredentials: true,
})

export function getStoredAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function storeAuthTokens({
  access,
  user,
}: {
  access: string
  refresh?: string
  user?: unknown
}) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access)

  if (typeof user !== 'undefined') {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function clearAuthTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getApiErrorPayload(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return null
  }

  return error.response?.data ?? null
}

async function refreshAccessToken() {
  try {
    const response = await publicClient.post<{ access?: string }>('/token/refresh')

    const nextAccessToken = typeof response.data?.access === 'string' ? response.data.access : null
    if (nextAccessToken) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, nextAccessToken)
    }

    return nextAccessToken
  } catch {
    return null
  }
}

export async function logoutAndRedirect(redirectTo = '/login') {
  clearAuthTokens()
  window.location.assign(redirectTo)
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken()
  if (accessToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config as RetriableRequestConfig | undefined
    const status = error.response?.status

    if (!originalConfig || status !== 401 || originalConfig._retry || originalConfig.url?.includes('/token/refresh')) {
      return Promise.reject(error)
    }

    originalConfig._retry = true

    const nextAccessToken = await refreshAccessToken()
    if (!nextAccessToken) {
      await logoutAndRedirect()
      return Promise.reject(error)
    }

    originalConfig.headers = originalConfig.headers ?? {}
    originalConfig.headers.Authorization = `Bearer ${nextAccessToken}`

    try {
      return await apiClient.request(originalConfig)
    } catch (retryError) {
      if (axios.isAxiosError(retryError) && retryError.response?.status === 401) {
        await logoutAndRedirect()
      }

      return Promise.reject(retryError)
    }
  }
)
