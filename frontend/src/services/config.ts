const API_URL = import.meta.env.VITE_API_URL
const rawApiBaseUrl = API_URL?.replace(/\/$/, '')

export const API_BASE_URL = rawApiBaseUrl ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
export const FX_API_BASE_URL = 'https://fxapi.app'