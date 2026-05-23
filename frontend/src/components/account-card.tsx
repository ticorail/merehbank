"use client"

import { ArrowUpRight, ArrowDownLeft, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { cn } from "@/services/utils"

interface AccountCardProps {
  currency: "HTG" | "USD"
  balance: number
  accountNumber: string
  isMain?: boolean
  layout?: "single" | "dual"
  onOpenDetails?: () => void
  onSendMoney?: () => void
  onReceiveMoney?: (accountNumber: string) => void
}

export function AccountCard({
  currency,
  balance,
  accountNumber,
  isMain,
  layout = "dual",
  onOpenDetails,
  onSendMoney,
  onReceiveMoney,
}: AccountCardProps) {
  const [showBalance, setShowBalance] = useState(true)
  const isSingleLayout = layout === "single"

  const formatBalance = (amount: number, curr: string) => {
    if (curr === "HTG") {
      return new Intl.NumberFormat("fr-HT", {
        style: "currency",
        currency: "HTG",
        minimumFractionDigits: 2,
      }).format(amount)
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl transition-all hover:shadow-lg",
        isSingleLayout ? "min-h-[300px] p-8 lg:p-9" : "p-6",
        currency === "HTG"
          ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
          : "bg-gradient-to-br from-emerald-500 to-green-400 text-emerald-50"
      )}
    >
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-white/5" />
      {isSingleLayout && (
        <div className="absolute bottom-8 right-20 h-48 w-48 rounded-full bg-white/6" />
      )}

      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenDetails}
                className="text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
              >
                Compte {currency}
              </button>
              {isMain && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  Principal
                </span>
              )}
            </div>
            <p className="mt-1 text-xs opacity-60">**** {accountNumber.slice(-4)}</p>
          </div>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label={showBalance ? "Masquer le solde" : "Afficher le solde"}
          >
            {showBalance ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-6">
          <p className="text-sm opacity-80">Solde disponible</p>
          <p
            className={cn(
              "mt-1 font-bold tracking-tight",
              isSingleLayout ? "text-4xl sm:text-5xl" : "text-3xl"
            )}
          >
            {showBalance ? formatBalance(balance, currency) : "••••••"}
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onSendMoney}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/20 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/30",
              isSingleLayout ? "py-3 text-base" : "py-2.5"
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
            Envoyer
          </button>
          <button
            type="button"
            onClick={() => onReceiveMoney?.(accountNumber)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/20 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/30",
              isSingleLayout ? "py-3 text-base" : "py-2.5"
            )}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Recevoir
          </button>
        </div>
      </div>
    </div>
  )
}
