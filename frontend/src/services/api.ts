import axios from 'axios'
import { apiClient, logoutAndRedirect } from '@/api/axios'

function toRequestData(body: BodyInit | null | undefined) {
  if (body == null) {
    return undefined
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }

  return body
}

function toResponse(data: unknown, status: number) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data ?? {})
  return new Response(payload, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = typeof input === 'string' ? input : input.toString()

  try {
    const response = await apiClient.request({
      url,
      method: init.method ?? 'GET',
      data: toRequestData(init.body),
      headers: Object.fromEntries(new Headers(init.headers ?? {}).entries()),
      signal: init.signal,
    })

    return toResponse(response.data, response.status)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        await logoutAndRedirect()
      }

      return toResponse(error.response.data, error.response.status)
    }

    throw error
  }
}