import { apiClient } from './axios'

export type MoneyRequestPayload = {
  debtor_email: string
  source_account_number: string
  amount: string
  message: string
}

export async function getNotifications<T = unknown>() {
  const response = await apiClient.get<T>('/notifications')
  return response.data
}

export async function createMoneyRequest<T = unknown>(payload: MoneyRequestPayload) {
  const response = await apiClient.post<T>('/money-requests', payload)
  return response.data
}

export async function acceptMoneyRequest<T = unknown>(requestId: number) {
  const response = await apiClient.post<T>(`/money-requests/${requestId}/accept`)
  return response.data
}

export async function rejectMoneyRequest<T = unknown>(requestId: number) {
  const response = await apiClient.post<T>(`/money-requests/${requestId}/reject`)
  return response.data
}
