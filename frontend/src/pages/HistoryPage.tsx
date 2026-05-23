import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Clock3, Filter, Wallet, RefreshCw, CreditCard } from 'lucide-react'
import { Header } from '@/components/navigation'
import { getAccounts, openAccount } from '@/api/accountApi'
import { getHistory } from '@/api/transactionApi'
import { cn } from '@/services/utils'
import {
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Layers, Coins, RotateCcw, ChevronDown, Filter as FilterIcon } from 'lucide-react'

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

type HistoryItem = {
  id: number
  history_date: string
  kind: 'transaction' | 'money_request'
  title: string
  message: string
  amount: string
  account_number: string
  account_currency: 'HTG' | 'USD'
  account_is_main: boolean
  counterpart_name: string
  status: string
}

type HistoryResponse = {
  filters: {
    month: number | null
    year: number | null
    kind: string
    currency: string
    is_before_history?: boolean
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
  results: HistoryItem[]
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

const KIND_OPTIONS = [
  { value: 'all', label: 'Tous les types' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'withdrawal', label: 'Retraits' },
  { value: 'transfer', label: 'Virements' },
  { value: 'money_request', label: 'Demandes' },
]

const CURRENCY_OPTIONS = [
  { value: 'all', label: 'Toutes les devises' },
  { value: 'HTG', label: 'HTG' },
  { value: 'USD', label: 'USD' },
]

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

function formatDate(timestamp: string) {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return timestamp
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function maskAccountNumber(accountNumber: string) {
  if (accountNumber.length <= 4) {
    return accountNumber
  }

  return `${'*'.repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`
}

function getAccountLabel(item: HistoryItem) {
  return `Compte ${item.account_currency}${item.account_is_main ? ' principal' : ''}`
}

function getKindIcon(item: HistoryItem) {
  if (item.kind === 'money_request') {
    return RefreshCw
  }

  if (item.title.toLowerCase().includes('reçu') || item.title.toLowerCase().includes('dépôt')) {
    return ArrowDownLeft
  }

  return ArrowUpRight
}

export default function HistoryPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedKind, setSelectedKind] = useState('all')
  const [selectedCurrency, setSelectedCurrency] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const loadAccounts = async () => {
    const accessToken = window.localStorage.getItem('merehbank_access_token')
    if (!accessToken) {
      return
    }

    try {
      const payload = await getAccounts()
      if (!Array.isArray(payload)) {
        setAccountsError('Réponse invalide du serveur.')
        return
      }

      setAccounts(payload as Account[])
      setAccountsError('')
    } catch {
      setAccountsError('Impossible de charger vos comptes pour le moment.')
    }
  }

  const loadHistory = async () => {
    const accessToken = window.localStorage.getItem('merehbank_access_token')
    if (!accessToken) {
      return
    }

    setHistoryLoading(true)
    setHistoryError('')

    try {
      const payload = await getHistory({
        page: currentPage,
        month: selectedMonth !== 'all' ? selectedMonth : undefined,
        year: selectedYear !== 'all' ? selectedYear : undefined,
        kind: selectedKind !== 'all' ? selectedKind : undefined,
        currency: selectedCurrency !== 'all' ? selectedCurrency : undefined,
      })

      if (!payload || !Array.isArray(payload.results) || !payload.pagination) {
        throw new Error('Réponse invalide du serveur.')
      }

      setHistory(payload as HistoryResponse)
      setHistoryError('')
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'Impossible de charger votre historique pour le moment.'
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (!window.localStorage.getItem('merehbank_access_token')) {
      window.location.replace('/login')
      return
    }

    void loadAccounts()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, selectedYear, selectedKind, selectedCurrency])

  useEffect(() => {
    void loadHistory()
  }, [currentPage, selectedMonth, selectedYear, selectedKind, selectedCurrency])

  if (!window.localStorage.getItem('merehbank_access_token')) {
    return null
  }

  const mainAccount = accounts.find((account) => account.is_main) ?? accounts[0] ?? null
  const primaryCurrency = mainAccount?.currency ?? null
  const availableYears = history?.available_years ?? []
  const pagination = history?.pagination ?? null
  const items = history?.results ?? []

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

    await loadAccounts()
    window.location.assign('/dashboard/history')
  }

  // Reusable FilterSelect subcomponent (native select styled)
  function FilterSelect({
    label,
    value,
    options,
    onChange,
    icon,
  }: {
    label: string
    value: string
    options: string[]
    onChange: (v: string) => void
    icon: React.ReactNode
  }) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors">{icon}</div>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none bg-background border border-border rounded-xl py-3 pl-10 pr-10 text-sm font-medium text-foreground cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {options.map((opt) => {
              // Map display label for months/years/types/currencies
              let labelText = opt
              if (opt === 'all') {
                if (label === 'Mois') labelText = 'Tous les mois'
                else if (label === 'Année') labelText = 'Toutes les années'
                else if (label === 'Type') labelText = 'Tous les types'
                else if (label === 'Devise') labelText = 'Toutes les devises'
              } else if (label === 'Mois') {
                labelText = MONTH_LABELS[Number(opt) - 1] ?? opt
              } else if (label === 'Année') {
                labelText = opt
              } else if (label === 'Type') {
                labelText = KIND_OPTIONS.find((o) => o.value === opt)?.label ?? opt
              } else if (label === 'Devise') {
                labelText = CURRENCY_OPTIONS.find((o) => o.value === opt)?.label ?? opt
              }

              return (
                <option key={opt} value={opt}>
                  {labelText}
                </option>
              )
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    )
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

          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">Historique</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Historique global de tous vos comptes, trié de la transaction la plus récente à la plus ancienne.
              </p>
            </div>

            {accountsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {accountsError}
              </div>
            ) : null}

            <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <FilterIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Filtres</h2>
                    <p className="text-sm text-muted-foreground">Filtrez par mois, année, type ou devise</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedMonth('all')
                    setSelectedYear('all')
                    setSelectedKind('all')
                    setSelectedCurrency('all')
                    setCurrentPage(1)
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    (selectedMonth !== 'all' || selectedYear !== 'all' || selectedKind !== 'all' || selectedCurrency !== 'all')
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Month */}
                <FilterSelect
                  label="Mois"
                  value={selectedMonth}
                  options={['all', ...MONTH_LABELS.map((_, i) => String(i + 1))]}
                  onChange={setSelectedMonth}
                  icon={<Calendar className="w-4 h-4" />}
                />

                {/* Year */}
                <FilterSelect
                  label="Année"
                  value={selectedYear}
                  options={['all', ...availableYears.map((y) => String(y))]}
                  onChange={setSelectedYear}
                  icon={<Calendar className="w-4 h-4" />}
                />

                {/* Type */}
                <FilterSelect
                  label="Type"
                  value={selectedKind}
                  options={KIND_OPTIONS.map((o) => o.value)}
                  onChange={setSelectedKind}
                  icon={<Layers className="w-4 h-4" />}
                />

                {/* Currency */}
                <FilterSelect
                  label="Devise"
                  value={selectedCurrency}
                  options={CURRENCY_OPTIONS.map((o) => o.value)}
                  onChange={setSelectedCurrency}
                  icon={<Coins className="w-4 h-4" />}
                />
              </div>

              {/* Active filters tags */}
              {(selectedMonth !== 'all' || selectedYear !== 'all' || selectedKind !== 'all' || selectedCurrency !== 'all') && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Filtres actifs:</span>
                    {selectedMonth !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        {selectedMonth === 'all' ? 'Tous les mois' : MONTH_LABELS[Number(selectedMonth) - 1]}
                      </span>
                    )}
                    {selectedYear !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        {selectedYear}
                      </span>
                    )}
                    {selectedKind !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        {KIND_OPTIONS.find((o) => o.value === selectedKind)?.label ?? selectedKind}
                      </span>
                    )}
                    {selectedCurrency !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        {CURRENCY_OPTIONS.find((o) => o.value === selectedCurrency)?.label ?? selectedCurrency}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border bg-card p-6">
              {historyError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {historyError}
                </div>
              ) : historyLoading ? (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/15 px-4 py-6 text-center text-sm text-muted-foreground">
                  Chargement de l’historique...
                </div>
              ) : items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item) => {
                    const Icon = getKindIcon(item)
                    const isCredit = item.title.toLowerCase().includes('reçu') || item.title.toLowerCase().includes('dépôt') || item.title.toLowerCase().includes('acceptée')
                    return (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-secondary/20 p-4 transition-colors hover:bg-secondary/35 lg:flex-row lg:items-start lg:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-xl',
                              isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.title}</p>
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {item.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatMoney(Number(item.amount), item.account_currency)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {getAccountLabel(item)} • {maskAccountNumber(item.account_number)}
                            </p>
                            {item.counterpart_name ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.kind === 'money_request' ? 'Correspondant' : 'Expéditeur / destinataire'} : {item.counterpart_name}
                              </p>
                            ) : null}
                            {item.message ? (
                              <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-4 lg:flex-col lg:items-end">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">
                              {item.account_currency}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(item.history_date)}
                            </p>
                          </div>
                          <Wallet className="h-4 w-4 text-muted-foreground" />
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
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/15 px-4 py-6 text-center text-sm text-muted-foreground">
                  {history?.filters?.is_before_history ? (
                    <span>Aucune transaction disponible pour cette période.</span>
                  ) : (
                    <span>Aucun élément ne correspond aux filtres sélectionnés.</span>
                  )}
                </div>
              )}
            </section>
          </section>
        </div>
      </main>
    </div>
  )
}
