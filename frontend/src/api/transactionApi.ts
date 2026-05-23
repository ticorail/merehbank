import { apiClient } from './axios'

export type TransferQuotePayload = {
  source_account_number: string
  destination_account_number: string
  amount: string
  recipient_name?: string
  request_id?: number
}

export type TransferPayload = TransferQuotePayload

export type HistoryQuery = {
  page?: number | string
  month?: number | string
  year?: number | string
  kind?: string
  currency?: string
}

export async function getTransactions<T = unknown>() {
  const response = await apiClient.get<T>('/transactions')
  return response.data
}

export async function getHistory<T = unknown>(query: HistoryQuery = {}) {
  const response = await apiClient.get<T>('/history', { params: query })
  return response.data
}

export async function getAccountTransactions<T = unknown>(accountNumber: string, query: HistoryQuery = {}) {
  const response = await apiClient.get<T>(`/accounts/${encodeURIComponent(accountNumber)}/transactions`, {
    params: query,
  })
  return response.data
}

export async function getTransferQuote<T = unknown>(payload: TransferQuotePayload) {
  const response = await apiClient.post<T>('/transfer/quote', payload)
  return response.data
}

export async function createTransfer<T = unknown>(payload: TransferPayload) {
  const response = await apiClient.post<T>('/transfer', payload)
  return response.data
}
