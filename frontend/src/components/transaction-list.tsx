"use client"

import { useEffect, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  RefreshCw,
  Smartphone,
  Zap,
} from "lucide-react"
import { getTransactions } from '@/api/transactionApi'
import { cn } from "@/services/utils"

type Account = {
  id: number
  account_number: string
  currency: "HTG" | "USD"
}

type TransactionListProps = {
  accounts: Account[]
  refreshKey?: number
}

type TransactionApi = {
  id: number
  transaction_type: "deposit" | "withdrawal" | "transfer"
  amount: string
  timestamp: string
  account: number | null
  source_account: number | null
  destination_account: number | null
  description: string
  source_owner_name: string
  destination_owner_name: string
  transfer_kind_label: string | null
  transfer_summary: string | null
  transfer_sent_amount: string | null
  transfer_received_amount: string | null
  transfer_exchange_rate: string | null
  source_account_number: string | null
  destination_account_number: string | null
  source_currency: "HTG" | "USD" | null
  destination_currency: "HTG" | "USD" | null
}

type DisplayTransaction = {
  id: number
  type: "credit" | "debit"
  description: string
  title: string
  details: string | null
  amount: number
  currency: "HTG" | "USD"
  date: string
  category: "transfer" | "payment" | "topup" | "utility"
}

const categoryIcons = {
  transfer: RefreshCw,
  payment: CreditCard,
  topup: Smartphone,
  utility: Zap,
}

function formatDate(timestamp: string) {
  const parsedDate = new Date(timestamp)

  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate)
}

export function TransactionList({
  accounts,
  refreshKey = 0,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([])
  const [transactionsError, setTransactionsError] = useState("")

  useEffect(() => {
    const accessToken = window.localStorage.getItem("merehbank_access_token")
    if (!accessToken) {
      return
    }

    const loadTransactions = async () => {
      try {
        const payload = await getTransactions()
        if (!Array.isArray(payload)) {
          setTransactionsError("Reponse invalide du serveur.")
          return
        }

        const accountIds = new Set(accounts.map((account) => account.id))
        const normalizedTransactions = (payload as TransactionApi[])
          .filter((transaction) => transaction.account !== null && accountIds.has(transaction.account))
          .map((transaction) => {
            const relatedAccount =
              accounts.find((account) => account.id === transaction.account) ?? null

            const type =
              transaction.transaction_type === "deposit"
                ? "credit"
                : transaction.transaction_type === "transfer"
                  ? transaction.account === transaction.destination_account
                    ? "credit"
                    : "debit"
                  : "debit"

            const category =
              transaction.transaction_type === "transfer"
                ? "transfer"
                : transaction.transaction_type === "deposit"
                  ? "topup"
                  : "payment"

            return {
              id: transaction.id,
              type,
              title:
                transaction.transaction_type === "transfer"
                  ? transaction.transfer_kind_label || "Transfert"
                  : transaction.description || "Transaction bancaire",
              description: transaction.description || "Transaction bancaire",
              details:
                transaction.transaction_type === "transfer"
                  ? transaction.transfer_summary
                  : null,
              amount: Number(transaction.amount),
              currency: relatedAccount?.currency ?? "HTG",
              date: formatDate(transaction.timestamp),
              category,
            } satisfies DisplayTransaction
          })
          .slice(0, 8)

        setTransactions(normalizedTransactions)
        setTransactionsError("")
      } catch {
        setTransactionsError("Impossible de charger les transactions pour le moment.")
      }
    }

    void loadTransactions()
  }, [accounts, refreshKey])

  const formatAmount = (
    amount: number,
    currency: string,
    type: "credit" | "debit"
  ) => {
    const prefix = type === "credit" ? "+" : "-"
    if (currency === "HTG") {
      return `${prefix} ${amount.toLocaleString("fr-HT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} HTG`
    }
    return `${prefix} $${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <div className="rounded-2xl bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transactions recentes</h2>
        <button
          type="button"
          onClick={() => window.location.assign('/dashboard/history')}
          className="text-sm font-medium text-primary hover:underline"
        >
          Voir tout
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {transactionsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {transactionsError}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/15 px-4 py-6 text-sm text-muted-foreground">
            Aucune transaction disponible pour le moment.
          </div>
        ) : (
          transactions.map((transaction) => {
            const Icon = categoryIcons[transaction.category]
            return (
              <div
                key={transaction.id}
                className="flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-secondary/50"
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    transaction.type === "credit"
                      ? "bg-accent/10 text-accent"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {transaction.type === "credit" ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : transaction.category === "transfer" ? (
                    <ArrowUpRight className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-medium">{transaction.title}</p>
                  {transaction.details && (
                    <p className="mt-1 text-xs text-muted-foreground">{transaction.details}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{transaction.date}</p>
                </div>

                <p
                  className={cn(
                    "font-semibold",
                    transaction.type === "credit" ? "text-emerald-500" : "text-foreground"
                  )}
                >
                  {formatAmount(transaction.amount, transaction.currency, transaction.type)}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
