"use client"

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { cn } from "@/services/utils"

interface ExchangeRateProps {
  buyRate: number | null
  sellRate: number | null
  updatedAt?: number | null
  className?: string
}

export function ExchangeRate({
  buyRate,
  sellRate,
  updatedAt,
  className,
}: ExchangeRateProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  const formatRate = (rate: number | null) => (rate === null ? '—' : rate.toFixed(2))

  const updatedLabel = (() => {
    if (typeof updatedAt !== 'number') {
      return 'Dernière mise à jour en cours'
    }

    const elapsedSeconds = Math.max(0, now - updatedAt)

    if (elapsedSeconds < 60) {
      return `Dernière mise à jour il y a ${elapsedSeconds} seconde${elapsedSeconds > 1 ? 's' : ''}`
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60)
    const remainingSeconds = elapsedSeconds % 60

    if (remainingSeconds === 0) {
      return `Dernière mise à jour il y a ${elapsedMinutes} minute${elapsedMinutes > 1 ? 's' : ''}`
    }

    return `Dernière mise à jour il y a ${elapsedMinutes} minute${elapsedMinutes > 1 ? 's' : ''} et ${remainingSeconds} seconde${remainingSeconds > 1 ? 's' : ''}`
  })()

  return (
    <div className={cn("rounded-2xl bg-card p-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Taux de change</h2>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <DollarSign className="h-4 w-4 text-primary" />
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">1 USD =</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatRate(buyRate)} <span className="text-lg font-normal text-muted-foreground">HTG</span>
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-accent/10 p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-accent">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-medium">Achat</span>
          </div>
          <p className="mt-1 text-lg font-semibold">{formatRate(buyRate)} HTG</p>
        </div>
        <div className="rounded-xl bg-destructive/10 p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-destructive">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Vente</span>
          </div>
          <p className="mt-1 text-lg font-semibold">{formatRate(sellRate)} HTG</p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {updatedLabel}
      </p>
    </div>
  )
}
