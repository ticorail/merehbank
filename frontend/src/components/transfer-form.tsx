"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Landmark, LoaderCircle, Send } from "lucide-react"
import { createTransfer, getTransferQuote } from '@/api/transactionApi'
import { cn } from "@/services/utils"

type Account = {
  id: number
  account_number: string
  balance: string
  currency: "HTG" | "USD"
  is_main: boolean
}

type TransferFormProps = {
  accounts: Account[]
  onTransferSuccess?: () => Promise<void> | void
  allowOwnDestination?: boolean
  initialSourceAccountNumber?: string
  onMoneyRequestCompleted?: (requestId: number) => void
  moneyRequestPrefill?: {
    requestId: number
    requesterName: string
    requesterEmail: string
    requesterAccountNumber: string
    requestId: number
    amount: string
    currency: 'HTG' | 'USD'
    message: string
  } | null
}

export function TransferForm({
  accounts,
  onTransferSuccess,
  allowOwnDestination = false,
  initialSourceAccountNumber,
  onMoneyRequestCompleted,
  moneyRequestPrefill = null,
}: TransferFormProps) {
  const [fromAccountNumber, setFromAccountNumber] = useState<string>("")
  const [destinationAccountNumber, setDestinationAccountNumber] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [amount, setAmount] = useState("")
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [quoteAmount, setQuoteAmount] = useState<string | null>(null)
  const [quoteCurrency, setQuoteCurrency] = useState<string | null>(null)
  const [quoteRate, setQuoteRate] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState("")
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogMessage, setConfirmDialogMessage] = useState("")
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [successDialogMessage, setSuccessDialogMessage] = useState("")
  const [hasCompletedTransfer, setHasCompletedTransfer] = useState(false)
  const isMoneyRequestMode = moneyRequestPrefill !== null

  useEffect(() => {
    if (initialSourceAccountNumber) {
      const preferredAccount = accounts.find(
        (account) => account.account_number === initialSourceAccountNumber
      )
      if (preferredAccount) {
        setFromAccountNumber(preferredAccount.account_number)
      }
    }

    if (moneyRequestPrefill) {
      setDestinationAccountNumber(moneyRequestPrefill.requesterAccountNumber)
      setRecipientName(moneyRequestPrefill.requesterName)
      setAmount(moneyRequestPrefill.amount)
      return
    }

    if (accounts.length === 0) {
      setFromAccountNumber("")
      return
    }

    const accountStillExists = accounts.some(
      (account) => account.account_number === fromAccountNumber
    )
    if (accountStillExists) {
      return
    }

    const defaultAccount =
      accounts.find((account) => account.is_main) ?? accounts[0]
    setFromAccountNumber(defaultAccount.account_number)
  }, [accounts, fromAccountNumber, moneyRequestPrefill, initialSourceAccountNumber])

  const selectedAccount =
    accounts.find((account) => account.account_number === fromAccountNumber) ?? null
  const hasMultipleAccounts = accounts.length > 1

  useEffect(() => {
    if (!selectedAccount || !destinationAccountNumber.trim() || !amount.trim()) {
      setQuoteAmount(null)
      setQuoteCurrency(null)
      setQuoteRate(null)
      setQuoteError("")
      setQuoteLoading(false)
      return
    }

    if (
      !allowOwnDestination &&
      accounts.some(
        (account) =>
          account.account_number.toUpperCase() === destinationAccountNumber.trim().toUpperCase()
      )
    ) {
      setQuoteAmount(null)
      setQuoteCurrency(null)
      setQuoteRate(null)
      setQuoteError("Utilisez le transfert interne pour vos propres comptes.")
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
            source_account_number: selectedAccount.account_number,
            destination_account_number: destinationAccountNumber.trim().toUpperCase(),
            recipient_name: recipientName.trim(),
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
              : "Impossible d'estimer ce virement pour le moment."
          )
        } finally {
          setQuoteLoading(false)
        }
      }

      void fetchQuote()
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [selectedAccount, destinationAccountNumber, amount, recipientName])

  const formatBalance = (balance: string, currency: "HTG" | "USD") => {
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

  const getErrorMessage = (payload: Record<string, unknown> | null) => {
    if (!payload) {
      return "Impossible d'envoyer cet argent pour le moment."
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

    return "Impossible d'envoyer cet argent pour le moment."
  }

  const loadCompletedRequestIds = () => {
    try {
      const raw = window.localStorage.getItem('merehbank_money_request_completed_ids')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : []
    } catch {
      return []
    }
  }

  const saveCompletedRequestId = (requestId: number) => {
    const nextIds = Array.from(new Set([...loadCompletedRequestIds(), requestId]))
    window.localStorage.setItem('merehbank_money_request_completed_ids', JSON.stringify(nextIds))
  }

  const executeTransfer = async () => {
    const accessToken = window.localStorage.getItem("merehbank_access_token")
    if (!accessToken) {
      window.location.replace("/login")
      return
    }

    if (hasCompletedTransfer) {
      return
    }

    if (!selectedAccount) {
      setSubmitError("Veuillez choisir un compte a debiter.")
      setSubmitSuccess("")
      return
    }

    if (!destinationAccountNumber.trim()) {
      setSubmitError("Veuillez saisir le numero de compte du beneficiaire.")
      setSubmitSuccess("")
      return
    }

    if (!amount.trim()) {
      setSubmitError("Veuillez saisir le montant a envoyer.")
      setSubmitSuccess("")
      return
    }

    if (
      !allowOwnDestination &&
      accounts.some(
        (account) =>
          account.account_number.toUpperCase() === destinationAccountNumber.trim().toUpperCase()
      )
    ) {
      setSubmitError("Utilisez le transfert interne pour vos propres comptes.")
      setSubmitSuccess("")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")
    setSubmitSuccess("")

    try {
      const payload = (await createTransfer({
        source_account_number: selectedAccount.account_number,
        destination_account_number: destinationAccountNumber.trim().toUpperCase(),
        recipient_name: recipientName.trim(),
        amount,
        request_id: moneyRequestPrefill?.requestId,
      })) as Record<string, unknown> | null

      setDestinationAccountNumber("")
      setRecipientName("")
      setAmount("")
      if (moneyRequestPrefill) {
        window.sessionStorage.removeItem('merehbank_money_request_prefill')
        saveCompletedRequestId(moneyRequestPrefill.requestId)
        onMoneyRequestCompleted?.(moneyRequestPrefill.requestId)
      }
      setHasCompletedTransfer(true)
      const recipientLabel = moneyRequestPrefill?.requesterName
        ? `${moneyRequestPrefill.amount} ${moneyRequestPrefill.currency} ont été envoyés avec succès à ${moneyRequestPrefill.requesterName}.`
        : 'Transaction effectuée avec succès.'
      setSuccessDialogMessage(recipientLabel)
      setSuccessDialogOpen(true)
      setSubmitSuccess(
        `Virement envoye avec succes vers ${payload?.destination_account_number ?? "le compte beneficiaire"}.`
      )

      window.setTimeout(() => {
        window.location.assign('/dashboard')
      }, 5000)

      if (onTransferSuccess) {
        await onTransferSuccess()
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer cet argent pour le moment."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (hasCompletedTransfer || isSubmitting) {
      return
    }

    if (moneyRequestPrefill) {
      if (!amount.trim()) {
        setSubmitError("Veuillez saisir le montant a envoyer.")
        setSubmitSuccess("")
        return
      }

      setSubmitError("")
      setConfirmDialogMessage(
        `Voulez-vous vraiment envoyer ${amount.trim()} ${moneyRequestPrefill.currency} à ${recipientName || moneyRequestPrefill.requesterName} ?`
      )
      setConfirmDialogOpen(true)
      return
    }

    void executeTransfer()
  }

  const handleConfirmYes = () => {
    setConfirmDialogOpen(false)
    void executeTransfer()
  }

  const handleConfirmNo = () => {
    setConfirmDialogOpen(false)
  }

  const closeSuccessDialog = () => {
    setSuccessDialogOpen(false)
  }

  return (
    <div className="rounded-2xl bg-card p-6">
      {confirmDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Confirmation requise</h3>
            <p className="mt-2 text-sm text-muted-foreground">{confirmDialogMessage}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleConfirmNo}
                disabled={isSubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-3 font-semibold text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmYes()}
                disabled={isSubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Envoi...' : 'Oui'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {successDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Transaction réussie</h3>
            <p className="mt-2 text-sm text-muted-foreground">{successDialogMessage || 'Transaction effectuée avec succès.'}</p>
            <p className="mt-3 text-xs text-muted-foreground">Redirection automatique vers le dashboard dans 5 secondes.</p>
            <button
              type="button"
              onClick={closeSuccessDialog}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
            >
              Continuer
            </button>
          </div>
        </div>
      ) : null}
      {moneyRequestPrefill ? null : (
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Envoyer de l'argent</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Virement vers un autre client de la banque a partir de votre compte.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {moneyRequestPrefill ? (
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-sm font-semibold">Demande d’argent à honorer</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nom : {moneyRequestPrefill.requesterName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Email : {moneyRequestPrefill.requesterEmail}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Montant demandé : {moneyRequestPrefill.amount} {moneyRequestPrefill.currency}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Message : {moneyRequestPrefill.message || 'Aucun message'}
            </p>
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium text-muted-foreground">Compte a debiter</label>

          {hasMultipleAccounts ? (
            <div className="relative mt-1">
              <button
                type="button"
                onClick={() => setShowFromDropdown((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/50 p-4 text-left transition-colors hover:bg-secondary"
              >
                <div>
                  <p className="font-medium">
                    Compte {selectedAccount?.currency ?? ""}
                    {selectedAccount?.is_main ? " principal" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAccount
                      ? `${selectedAccount.account_number} • ${formatBalance(selectedAccount.balance, selectedAccount.currency)}`
                      : "Choisissez un compte"}
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </button>

              {showFromDropdown && (
                <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-lg">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setFromAccountNumber(account.account_number)
                        setShowFromDropdown(false)
                      }}
                      className={cn(
                        "w-full rounded-lg p-3 text-left transition-colors hover:bg-secondary",
                        account.account_number === selectedAccount?.account_number && "bg-secondary"
                      )}
                    >
                      <p className="font-medium">
                        Compte {account.currency}
                        {account.is_main ? " principal" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {account.account_number} • {formatBalance(account.balance, account.currency)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : selectedAccount ? (
            <div className="mt-1 rounded-xl border border-border bg-secondary/35 p-4">
              <p className="font-medium">
                Compte {selectedAccount.currency}
                {selectedAccount.is_main ? " principal" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedAccount.account_number} • {formatBalance(selectedAccount.balance, selectedAccount.currency)}
              </p>
            </div>
          ) : (
            <div className="mt-1 rounded-xl border border-dashed border-border bg-secondary/15 p-4 text-sm text-muted-foreground">
              Aucun compte disponible pour effectuer un virement.
            </div>
          )}
        </div>

        <div>
          {moneyRequestPrefill ? (
            <div className="rounded-xl border border-border bg-secondary/35 p-4">
              <p className="text-sm font-medium text-muted-foreground">Bénéficiaire</p>
              <p className="mt-1 text-base font-semibold">{moneyRequestPrefill.requesterName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{moneyRequestPrefill.requesterEmail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Le compte bancaire est déjà renseigné de manière sécurisée.
              </p>
            </div>
          ) : (
            <>
              <label
                htmlFor="destination-account-number"
                className="text-sm font-medium text-muted-foreground"
              >
                Numero de compte du beneficiaire
              </label>
              <input
                id="destination-account-number"
                type="text"
                value={destinationAccountNumber}
                onChange={(event) => setDestinationAccountNumber(event.target.value)}
                placeholder="Ex: HTG000123"
                className="mt-1 w-full rounded-xl border border-border bg-secondary/50 p-4 text-base font-medium uppercase placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Le numero de compte est la seule information utilisee pour valider le virement.
              </p>
            </>
          )}
        </div>

        <div>
          <label htmlFor="recipient-name" className="text-sm font-medium text-muted-foreground">
            Nom du titulaire
          </label>
          <input
            id="recipient-name"
            type="text"
            value={recipientName}
            readOnly={isMoneyRequestMode}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Ex: Jean Dupont"
            className="mt-1 w-full rounded-xl border border-border bg-secondary/50 p-4 text-base placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:cursor-not-allowed read-only:bg-secondary/70"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Ce champ est informatif et ne bloque pas l'envoi si le numero de compte est valide.
          </p>
        </div>

        <div>
          <label htmlFor="transfer-amount" className="text-sm font-medium text-muted-foreground">
            Montant
          </label>
          <div className="relative mt-1">
            <input
              id="transfer-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-secondary/50 p-4 pr-16 text-lg font-semibold placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">
              {selectedAccount?.currency ?? ""}
            </span>
          </div>
        </div>

        {selectedAccount && destinationAccountNumber.trim() && amount.trim() && (
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">Montant reçu estimé</p>
            <p className="mt-1 text-lg font-semibold">
              {quoteLoading
                ? "Calcul en cours..."
                : quoteError
                  ? quoteError
                  : quoteAmount && quoteCurrency
                    ? `${quoteAmount} ${quoteCurrency}`
                    : "—"}
            </p>
            {quoteRate && !quoteLoading && !quoteError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Taux utilisé: 1 {selectedAccount.currency} = {quoteRate} {quoteCurrency}
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
          disabled={isSubmitting || !selectedAccount || successDialogOpen || hasCompletedTransfer || confirmDialogOpen}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {isSubmitting ? "Envoi en cours..." : "Envoyer l'argent"}
        </button>
      </div>
    </div>
  )
}
