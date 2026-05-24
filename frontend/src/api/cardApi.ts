import axios from 'axios'
import { FX_API_BASE_URL } from '@/services/config'

const fxClient = axios.create({
  baseURL: FX_API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
})

export type ExchangeRates = {
  buyRate: number | null
  sellRate: number | null
  updatedAt: number | null
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  const [usdToHtgResponse, htgToUsdResponse] = await Promise.all([
    fxClient.get('/api/USD/HTG.json'),
    fxClient.get('/api/HTG/USD.json'),
  ])

  const buyRate =
    typeof usdToHtgResponse.data?.rate === 'number' ? usdToHtgResponse.data.rate : null
  const sellRate =
    typeof htgToUsdResponse.data?.rate === 'number' ? htgToUsdResponse.data.rate : null

  return {
    buyRate,
    sellRate,
    updatedAt: buyRate || sellRate ? Math.floor(Date.now() / 1000) : null,
  }
}
