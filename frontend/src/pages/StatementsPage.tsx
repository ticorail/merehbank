import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Calendar, ChevronDown, Download, Filter as FilterIcon, RotateCcw, FileText } from 'lucide-react'
import { Header } from '@/components/navigation'
import { getAccounts, openAccount } from '@/api/accountApi'

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

type StatementsPageProps = {
  accountNumber: string
}

type StatementDocument = {
  id: string
  month: number
  year: number
  label: string
  periodLabel: string
  fileName: string
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

function buildAvailableYears(createdAt: string) {
  const openingYear = new Date(createdAt).getFullYear()
  const currentYear = new Date().getFullYear()
  return Array.from({ length: currentYear - openingYear + 1 }, (_, index) => openingYear + index)
}

function buildStatementDocuments(account: Account): StatementDocument[] {
  const openingDate = new Date(account.created_at)
  const currentDate = new Date()
  const documents: StatementDocument[] = []

  let cursor = new Date(openingDate.getFullYear(), openingDate.getMonth(), 1)
  const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)

  while (cursor <= end) {
    const month = cursor.getMonth()
    const year = cursor.getFullYear()
    const periodLabel = `${MONTH_LABELS[month]} ${year}`
    documents.push({
      id: `${account.account_number}-${year}-${month + 1}`,
      month,
      year,
      label: `Relevé bancaire - ${periodLabel}`,
      periodLabel,
      fileName: `releve-${account.currency.toLowerCase()}-${year}-${String(month + 1).padStart(2, '0')}.pdf`,
    })
    cursor = new Date(year, month + 1, 1)
  }

  return documents.reverse()
}

function readInitialFilter(name: string) {
  if (typeof window === 'undefined') {
    return 'all'
  }

  const value = new URLSearchParams(window.location.search).get(name)
  return value && value.trim() ? value : 'all'
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  icon: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-primary">
          {icon}
        </div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/50 hover:shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

export default function StatementsPage({ accountNumber }: StatementsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [accountError, setAccountError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => readInitialFilter('month'))
  const [selectedYear, setSelectedYear] = useState<string>(() => readInitialFilter('year'))

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
    if (selectedMonth === 'all' && selectedYear === 'all') {
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    const params = new URLSearchParams()
    if (selectedMonth !== 'all') {
      params.set('month', selectedMonth)
    }
    if (selectedYear !== 'all') {
      params.set('year', selectedYear)
    }

    const query = params.toString()
    window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname)
  }, [selectedMonth, selectedYear])

  if (!window.localStorage.getItem('merehbank_access_token')) {
    return null
  }

  const mainAccount = accounts.find((item) => item.is_main) ?? accounts[0] ?? null
  const primaryCurrency = mainAccount?.currency ?? null
  const isMain = account?.is_main ?? false
  const availableYears = useMemo(
    () => (account ? buildAvailableYears(account.created_at) : []),
    [account]
  )
  const statementDocuments = useMemo(
    () => (account ? buildStatementDocuments(account) : []),
    [account]
  )
  const filteredDocuments = useMemo(
    () =>
      statementDocuments.filter((document) => {
        const monthMatches = selectedMonth === 'all' || document.month === Number(selectedMonth)
        const yearMatches = selectedYear === 'all' || document.year === Number(selectedYear)
        return monthMatches && yearMatches
      }),
    [statementDocuments, selectedMonth, selectedYear]
  )
  const selectedDocument = filteredDocuments[0] ?? null
  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce<Record<number, StatementDocument[]>>((groups, document) => {
      if (!groups[document.year]) {
        groups[document.year] = []
      }

      groups[document.year].push(document)
      return groups
    }, {})
  }, [filteredDocuments])
  const groupedYears = Object.keys(groupedDocuments)
    .map(Number)
    .sort((left, right) => right - left)

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
            onClick={() => window.location.assign(`/dashboard/account/${encodeURIComponent(accountNumber)}`)}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au compte
          </button>

          {accountError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {accountError}
            </div>
          ) : account ? (
            <div className="space-y-6">
              <section className="rounded-2xl border bg-card p-3 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <FilterIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">Filtres</h2>
                      <p className="text-xs text-muted-foreground">
                        Filtrez les relevés par mois et par année.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth('all')
                      setSelectedYear('all')
                      setSelectedDocument(null)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réinitialiser
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FilterSelect
                    label="Mois"
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    icon={<Calendar className="h-4 w-4" />}
                    options={[
                      { value: 'all', label: 'Tous les mois' },
                      ...MONTH_LABELS.map((monthLabel, index) => ({
                        value: String(index + 1),
                        label: monthLabel,
                      })),
                    ]}
                  />

                  <FilterSelect
                    label="Année"
                    value={selectedYear}
                    onChange={setSelectedYear}
                    icon={<Calendar className="h-4 w-4" />}
                    options={[
                      { value: 'all', label: 'Toutes les années' },
                      ...availableYears.map((year) => ({ value: String(year), label: String(year) })),
                    ]}
                  />
                </div>

                {(selectedMonth !== 'all' || selectedYear !== 'all') && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">Filtres actifs :</span>
                    {selectedMonth !== 'all' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Mois : {MONTH_LABELS[Number(selectedMonth) - 1]}
                      </span>
                    )}
                    {selectedYear !== 'all' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Année : {selectedYear}
                      </span>
                    )}
                  </div>
                )}
              </section>

              {filteredDocuments.length > 0 ? (
                groupedYears.map((year) => (
                  <section key={year} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{year}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Relevés mensuels disponibles pour cette année.
                        </p>
                      </div>
                      <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {groupedDocuments[year].length} relevé{groupedDocuments[year].length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {groupedDocuments[year].map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-col gap-3 rounded-xl border border-border/80 bg-secondary/10 p-3 transition-colors hover:bg-secondary/25 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{document.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Document PDF • {document.periodLabel}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <a
                              href={`${window.location.pathname}?month=${document.month}&year=${document.year}`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Ouvrir
                            </a>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Télécharger
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucun relevé bancaire ne correspond aux filtres sélectionnés.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
