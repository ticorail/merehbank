import { clearAuthTokens, getStoredAccessToken, publicClient } from './axios'

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirm: string
  main_currency: 'HTG' | 'USD'
  terms: boolean
}

export async function loginUser<T = { access: string; user?: unknown }>(payload: LoginPayload) {
  const response = await publicClient.post<T>('/login', payload)
  return response.data
}

export async function registerUser<T = { message?: string }>(payload: RegisterPayload) {
  const response = await publicClient.post<T>('/register', payload)
  return response.data
}

export async function logoutUser(redirectTo = '/login') {
  const accessToken = getStoredAccessToken()

  try {
    if (accessToken) {
      await publicClient.post(
        '/logout',
        undefined,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
    } else {
      await publicClient.post('/logout')
    }
  } catch {
    // best effort logout
  } finally {
    clearAuthTokens()
    window.location.assign(redirectTo)
  }
}
