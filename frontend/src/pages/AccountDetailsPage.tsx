import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Wallet, CreditCard, ShieldCheck, Landmark, ArrowDownLeft, ArrowUpRight, RefreshCw, FileText } from 'lucide-react'
import { Header } from '@/components/navigation'
import { getAccounts, openAccount } from '@/api/accountApi'
import { getAccountTransactions } from '@/api/transactionApi'
import { cn } from '@/services/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Account = {
  id: number
  account_number: string
  balance: string
  overdraft_limit: string
  available_balance: string
  currency: 'HTG' | 'USD'
  is_main: boolean
  created_at: string
}

type AccountDetailsPageProps = {
  accountNumber: string
}

type TransactionApi = {
  id: number
  transaction_type: 'deposit' | 'withdrawal' | 'transfer'
  amount: string
  timestamp: string
  status: string
  account: number | null
  account_currency: 'HTG' | 'USD' | null
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
  source_currency: 'HTG' | 'USD' | null
  destination_currency: 'HTG' | 'USD' | null
}

type TransactionsResponse = {
  account: Account
  filters: {
    month: number | null
    year: number | null
    is_before_account_opening?: boolean
    is_future_period?: boolean
  }
  available_years: number[]
  pagination: {
    count: number
    page: number
    page_size: number
    num_pages: number
    has_next: boolean
    has_previous: boolean
  }
  results: TransactionApi[]
}

const MONTH_LABELS = [
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Aout',
  'Septembre',
  'Octobre',
  'Novembre',
  'Decembre',
] as const

const TRANSACTION_TYPE_LABELS = {
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  transfer: 'Virement',
} as const

function formatMoney(amount: number, currency: 'HTG' | 'USD') {
  if (currency === 'HTG') {
    return new Intl.NumberFormat('fr-HT', {
      style: 'currency',
      currency: 'HTG',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function getAccountName(account: Account, isMain: boolean) {
  return `Compte ${account.currency}${isMain ? ' principal' : ''}`
}

function formatTransactionAmount(amount: number, currency: 'HTG' | 'USD', direction: 'credit' | 'debit') {
  const prefix = direction === 'credit' ? '+' : '-'
  if (currency === 'HTG') {
    return `${prefix} ${amount.toLocaleString('fr-HT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} HTG`
  }

  return `${prefix} $${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatTransactionDate(timestamp: string) {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return timestamp
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function buildAvailableYears(createdAt: string) {
  const openingYear = new Date(createdAt).getFullYear()
  const currentYear = new Date().getFullYear()
  return Array.from({ length: currentYear - openingYear + 1 }, (_, index) => openingYear + index)
}

export default function AccountDetailsPage({ accountNumber }: AccountDetailsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [accountError, setAccountError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [transactionsPage, setTransactionsPage] = useState<TransactionsResponse | null>(null)
  const [transactionsError, setTransactionsError] = useState('')
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  const loadAccount = async () => {
    const accessToken = window.localStorage.getItem('merehbank_access_token')
    if (!accessToken) {
      window.location.replace('/login')
      return
    }

    try {
      const payload = await getAccounts()
      if (!Array.isArray(payload)) {
        setAccountError('Réponse invalide du serveur.')
        return
      }

      const typedAccounts = payload as Account[]
      const matchedAccount =
        typedAccounts.find((item) => item.account_number === decodeURIComponent(accountNumber)) ?? null

      setAccounts(typedAccounts)
      setAccount(matchedAccount)
      setAccountError(matchedAccount ? '' : 'Compte introuvable.')
    } catch {
      setAccountError('Impossible de charger les informations du compte.')
    }
  }

  useEffect(() => {
    void loadAccount()
  }, [accountNumber])

  useEffect(() => {
    setSelectedMonth('all')
    setSelectedYear('all')
    setCurrentPage(1)
    setTransactionsPage(null)
  }, [accountNumber])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    if (!account) {
      return
    }

    const loadTransactions = async () => {
      const accessToken = window.localStorage.getItem('merehbank_access_token')
      if (!accessToken) {
        return
      }

      setTransactionsLoading(true)
      setTransactionsError('')

      try {
        const payload = (await getAccountTransactions(account.account_number, {
          page: currentPage,
          month: selectedMonth !== 'all' ? selectedMonth : undefined,
          year: selectedYear !== 'all' ? selectedYear : undefined,
        })) as TransactionsResponse | null
        if (!payload || !Array.isArray(payload.results)) {
          throw new Error('Réponse invalide du serveur.')
        }

        setTransactionsPage(payload)
      } catch (error) {
        setTransactionsError(
          error instanceof Error ? error.message : 'Impossible de charger les transactions du compte.'
        )
      } finally {
        setTransactionsLoading(false)
      }
    }

    void loadTransactions()
  }, [account, selectedMonth, selectedYear, currentPage])

  if (!window.localStorage.getItem('merehbank_access_token')) {
    return null
  }

  const mainAccount = accounts.find((item) => item.is_main) ?? accounts[0] ?? null
  const primaryCurrency = mainAccount?.currency ?? null
  const isMain = account?.is_main ?? false
  const balance = account ? Number(account.balance) : 0
  const availableBalance = account ? Number(account.available_balance) : 0
  const availableYears = useMemo(
    () => (account ? buildAvailableYears(account.created_at) : []),
    [account]
  )
  const transactions = transactionsPage?.results ?? []
  const pagination = transactionsPage?.pagination ?? null

  const handleOpenSecondaryAccount = async () => {
    const accessToken = window.localStorage.getItem('merehbank_access_token')
    if (!accessToken) {
      window.location.replace('/login')
      return
    }

    const targetCurrency = primaryCurrency === 'USD' ? 'HTG' : 'USD'

    const payload = await openAccount({ currency: targetCurrency })

    if (!payload || typeof payload !== 'object') {
      throw new Error("Impossible d'ouvrir ce compte pour le moment.")
    }

    await loadAccount()
    window.location.assign('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        primaryCurrency={primaryCurrency}
        canOpenSecondaryAccount={accounts.length === 1}
        onOpenSecondaryAccount={handleOpenSecondaryAccount}
      />

      <main className="lg:ml-64">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
          <button
            type="button"
            onClick={() => window.location.assign('/dashboard')}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard
          </button>

          {accountError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {accountError}
            </div>
          ) : account ? (
            <div className="space-y-6">
              <section
                className={cn(
                  'relative overflow-hidden rounded-3xl p-7 text-white shadow-sm',
                  account.currency === 'HTG'
                    ? 'bg-gradient-to-br from-primary to-primary/80'
                    : 'bg-gradient-to-br from-emerald-500 to-green-400'
                )}
              >
                <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
                <div className="absolute bottom-4 right-20 h-40 w-40 rounded-full bg-white/7" />
                <div className="absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-white/6" />

                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/75">Nom du compte</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                      {getAccountName(account, isMain)}
                    </h1>
                    <p className="mt-3 text-sm text-white/70">
                      Numero de compte: {account.account_number}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-white/75">Solde disponible</p>
                    <p className="mt-2 text-4xl font-bold sm:text-5xl">
                      {formatMoney(availableBalance, account.currency)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-500/10 p-3 text-amber-600">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nom du compte</p>
                      <p className="mt-1 text-base font-semibold">
                        {getAccountName(account, isMain)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Numero de compte</p>
                      <p className="mt-1 text-base font-semibold">{account.account_number}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Solde du compte</p>
                      <p className="mt-1 text-base font-semibold">
                        {formatMoney(balance, account.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-chart-3/10 p-3 text-chart-3">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Découvert</p>
                      <p className="mt-1 text-base font-semibold">
                        {Number(account.overdraft_limit) > 0
                          ? formatMoney(Number(account.overdraft_limit), account.currency)
                          : 'Aucun découvert accordé'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Solde disponible</p>
                      <p className="mt-1 text-base font-semibold">
                        {formatMoney(availableBalance, account.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href={`/dashboard/account/${encodeURIComponent(account.account_number)}/statements`}
                  className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Relevé bancaire</p>
                      <p className="mt-1 text-base font-semibold">Ouvrir les relevés mensuels</p>
                    </div>
                  </div>
                </a>
              </section>

              <section className="rounded-3xl border bg-card p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Historique des transactions</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Transactions du compte triées de la plus récente à la plus ancienne.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Mois
                      </p>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-full min-w-40">
                          <SelectValue placeholder="Tous les mois" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les mois</SelectItem>
                          {MONTH_LABELS.map((monthLabel, index) => (
                            <SelectItem key={monthLabel} value={String(index + 1)}>
                              {monthLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Annee
                      </p>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-full min-w-32">
                          <SelectValue placeholder="Toutes les annees" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes les annees</SelectItem>
                          {availableYears.map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {transactionsError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {transactionsError}
                    </div>
                  ) : transactionsLoading ? (
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/15 px-4 py-6 text-center text-sm text-muted-foreground">
                      Chargement des transactions...
                    </div>
                  ) : transactions.length > 0 ? (
                    <>
                      {transactions.map((transaction) => {
                        const isCredit =
                          transaction.transaction_type === 'deposit' ||
                          (transaction.transaction_type === 'transfer' &&
                            transaction.account === transaction.destination_account)
                        const title =
                          transaction.transaction_type === 'transfer'
                            ? transaction.transfer_kind_label || TRANSACTION_TYPE_LABELS.transfer
                            : TRANSACTION_TYPE_LABELS[transaction.transaction_type]
                        const counterpart =
                          transaction.transaction_type === 'transfer'
                            ? isCredit
                              ? transaction.source_owner_name || transaction.source_account_number || 'Client'
                              : transaction.destination_owner_name || transaction.destination_account_number || 'Client'
                            : null
                        const currency =
                          transaction.account_currency ?? account.currency

                        return (
                          <div
                            key={transaction.id}
                            className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-secondary/20 p-4 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'flex h-12 w-12 items-center justify-center rounded-xl',
                                  isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {transaction.transaction_type === 'transfer' ? (
                                  isCredit ? (
                                    <ArrowDownLeft className="h-5 w-5" />
                                  ) : (
                                    <ArrowUpRight className="h-5 w-5" />
                                  )
                                ) : (
                                  <RefreshCw className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {formatTransactionAmount(Number(transaction.amount), currency, isCredit ? 'credit' : 'debit')}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {counterpart ? `${isCredit ? 'Expéditeur' : 'Destinataire'} : ${counterpart}` : 'Transaction bancaire'}
                                </p>
                                {transaction.description ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {transaction.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              <span className="rounded-full border border-border bg-background px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {transaction.status}
                              </span>
                              <p className="text-sm text-muted-foreground">{formatTransactionDate(transaction.timestamp)}</p>
                            </div>
                          </div>
                        )
                      })}

                      {pagination ? (
                        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-muted-foreground">
                            Page {pagination.page} sur {pagination.num_pages} · {pagination.count} transaction{pagination.count > 1 ? 's' : ''}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={!pagination.has_previous}
                              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Précédent
                            </button>
                            <button
                              type="button"
                              disabled={!pagination.has_next}
                              onClick={() => setCurrentPage((page) => page + 1)}
                              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Suivant
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/15 px-4 py-6 text-center text-sm text-muted-foreground">
                      {transactionsPage?.filters?.is_before_account_opening ? (
                        <span>Aucune transaction disponible pour cette période.</span>
                      ) : (
                        <span>Aucune transaction ne correspond aux filtres sélectionnés.</span>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
