"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, LoaderCircle, ArrowRightLeft } from "lucide-react"
import { createTransfer, getTransferQuote } from '@/api/transactionApi'
import { cn } from "@/services/utils"

type Account = {
  id: number
  account_number: string
  balance: string
  currency: "HTG" | "USD"
  is_main: boolean
}

type InternalTransferFormProps = {
  accounts: Account[]
  onTransferSuccess?: () => Promise<void> | void
}

function formatBalance(balance: string, currency: "HTG" | "USD") {
  const numericBalance = Number(balance)
  if (currency === "HTG") {
    return `${numericBalance.toLocaleString("fr-HT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} HTG`
  }

  return `$${numericBalance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function getErrorMessage(payload: Record<string, unknown> | null) {
  if (!payload) {
    return "Impossible d'estimer ce transfert pour le moment."
  }

  if (Array.isArray(payload) && typeof payload[0] === "string") {
    return payload[0]
  }

  const destinationErrors = payload.destination_account_number
  if (Array.isArray(destinationErrors) && typeof destinationErrors[0] === "string") {
    return destinationErrors[0]
  }
  if (typeof destinationErrors === "string") {
    return destinationErrors
  }

  const amountErrors = payload.amount
  if (Array.isArray(amountErrors) && typeof amountErrors[0] === "string") {
    return amountErrors[0]
  }
  if (typeof amountErrors === "string") {
    return amountErrors
  }

  if (typeof payload.detail === "string") {
    return payload.detail
  }

  if (Array.isArray(payload.non_field_errors) && typeof payload.non_field_errors[0] === "string") {
    return payload.non_field_errors[0]
  }

  return "Impossible d'estimer ce transfert pour le moment."
}

export function InternalTransferForm({ accounts, onTransferSuccess }: InternalTransferFormProps) {
  const [sourceAccountNumber, setSourceAccountNumber] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [quoteAmount, setQuoteAmount] = useState<string | null>(null)
  const [quoteCurrency, setQuoteCurrency] = useState<string | null>(null)
  const [quoteRate, setQuoteRate] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState("")
  const [quoteLoading, setQuoteLoading] = useState(false)

  useEffect(() => {
    if (accounts.length === 0) {
      setSourceAccountNumber("")
      return
    }

    const stillExists = accounts.some((account) => account.account_number === sourceAccountNumber)
    if (stillExists) {
      return
    }

    const defaultAccount = accounts.find((account) => account.is_main) ?? accounts[0]
    setSourceAccountNumber(defaultAccount.account_number)
  }, [accounts, sourceAccountNumber])

  const sourceAccount =
    accounts.find((account) => account.account_number === sourceAccountNumber) ?? null
  const destinationAccount = useMemo(() => {
    if (!sourceAccount) {
      return null
    }

    return accounts.find((account) => account.id !== sourceAccount.id && account.currency !== sourceAccount.currency) ?? null
  }, [accounts, sourceAccount])

  const hasEnoughAccounts = accounts.length >= 2 && sourceAccount !== null && destinationAccount !== null

  useEffect(() => {
    if (!sourceAccount || !destinationAccount || !amount.trim()) {
      setQuoteAmount(null)
      setQuoteCurrency(null)
      setQuoteRate(null)
      setQuoteError("")
      setQuoteLoading(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      const fetchQuote = async () => {
        setQuoteLoading(true)
        setQuoteError("")

        try {
          const payload = (await getTransferQuote({
            source_account_number: sourceAccount.account_number,
            destination_account_number: destinationAccount.account_number,
            amount,
          })) as Record<string, unknown> | null

          setQuoteAmount(
            typeof payload?.estimated_received_amount === "string"
              ? payload.estimated_received_amount
              : null
          )
          setQuoteCurrency(
            typeof payload?.destination_currency === "string"
              ? payload.destination_currency
              : null
          )
          setQuoteRate(
            typeof payload?.exchange_rate === "string" ? payload.exchange_rate : null
          )
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return
          }

          setQuoteAmount(null)
          setQuoteCurrency(null)
          setQuoteRate(null)
          setQuoteError(
            error instanceof Error
              ? error.message
              : "Impossible d'estimer ce transfert pour le moment."
          )
        } finally {
          setQuoteLoading(false)
        }
      }

      void fetchQuote()
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [amount, destinationAccount, sourceAccount])

  const handleSubmit = async () => {
    const accessToken = window.localStorage.getItem("merehbank_access_token")
    if (!accessToken) {
      window.location.replace("/login")
      return
    }

    if (!sourceAccount || !destinationAccount) {
      setSubmitError("Veuillez choisir deux comptes différents.")
      setSubmitSuccess("")
      return
    }

    if (!amount.trim()) {
      setSubmitError("Veuillez saisir le montant à transférer.")
      setSubmitSuccess("")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")
    setSubmitSuccess("")

    try {
      const payload = (await createTransfer({
        source_account_number: sourceAccount.account_number,
        destination_account_number: destinationAccount.account_number,
        recipient_name: destinationAccount.is_main ? 'Compte principal' : 'Compte secondaire',
        amount,
      })) as Record<string, unknown> | null

      setAmount("")
      setSubmitSuccess(
        `Transfert interne effectué vers ${destinationAccount.account_number}.`
      )

      if (onTransferSuccess) {
        await onTransferSuccess()
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Impossible d'effectuer ce transfert pour le moment."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card p-6">
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Compte à débiter</label>
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setShowSourceDropdown((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/50 p-4 text-left transition-colors hover:bg-secondary"
            >
              <div>
                <p className="font-medium">
                  {sourceAccount
                    ? `Compte ${sourceAccount.currency}${sourceAccount.is_main ? ' principal' : ''}`
                    : 'Choisissez un compte'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {sourceAccount
                    ? `${sourceAccount.account_number} • ${formatBalance(sourceAccount.balance, sourceAccount.currency)}`
                    : 'Sélectionnez le compte à débiter'}
                </p>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>

            {showSourceDropdown && (
              <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-lg">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      setSourceAccountNumber(account.account_number)
                      setShowSourceDropdown(false)
                    }}
                    className={cn(
                      'w-full rounded-lg p-3 text-left transition-colors hover:bg-secondary',
                      account.account_number === sourceAccount?.account_number && 'bg-secondary'
                    )}
                  >
                    <p className="font-medium">
                      Compte {account.currency}
                      {account.is_main ? ' principal' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {account.account_number} • {formatBalance(account.balance, account.currency)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/35 p-4">
          <p className="text-sm font-medium text-muted-foreground">Compte à créditer</p>
          <p className="mt-1 text-base font-semibold">
            {destinationAccount
              ? `${destinationAccount.account_number} • Compte ${destinationAccount.currency}${destinationAccount.is_main ? ' principal' : ''}`
              : 'Aucun compte opposé trouvé'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Le compte crédité est déterminé automatiquement selon la devise opposée.
          </p>
        </div>

        <div>
          <label htmlFor="internal-transfer-amount" className="text-sm font-medium text-muted-foreground">
            Montant
          </label>
          <div className="relative mt-1">
            <input
              id="internal-transfer-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-secondary/50 p-4 pr-16 text-lg font-semibold placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">
              {sourceAccount?.currency ?? ''}
            </span>
          </div>
        </div>

        {sourceAccount && destinationAccount && amount.trim() && (
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">Montant converti avant confirmation</p>
            <p className="mt-1 text-lg font-semibold">
              {quoteLoading
                ? 'Calcul en cours...'
                : quoteError
                  ? quoteError
                  : quoteAmount && quoteCurrency
                    ? `${quoteAmount} ${quoteCurrency}`
                    : '—'}
            </p>
            {quoteRate && !quoteLoading && !quoteError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Taux de change utilisé : 1 {sourceAccount.currency} = {quoteRate} {quoteCurrency}
              </p>
            )}
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {submitSuccess}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !hasEnoughAccounts}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowRightLeft className="h-5 w-5" />}
          {isSubmitting ? 'Transfert en cours...' : 'Transférer'}
        </button>
      </div>
    </div>
  )
}
