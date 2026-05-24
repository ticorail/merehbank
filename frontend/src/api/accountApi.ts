import { apiClient } from './axios'

export type OpenAccountPayload = {
  currency: 'HTG' | 'USD'
}

export async function getAccounts<T = unknown>() {
  const response = await apiClient.get<T>('/account')
  return response.data
}

export async function openAccount<T = unknown>(payload: OpenAccountPayload) {
  const response = await apiClient.post<T>('/account', payload)
  return response.data
}
