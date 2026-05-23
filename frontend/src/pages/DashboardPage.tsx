import { useEffect, useRef, useState } from 'react'
import { AccountCard } from '@/components/account-card'
import { ExchangeRate } from '@/components/exchange-rate'
import { Header } from '@/components/navigation'
import { QuickActions } from '@/components/quick-actions'
import { TransactionList } from '@/components/transaction-list'
import { TransferForm } from '@/components/transfer-form'
import { getAccounts, openAccount } from '@/api/accountApi'
import { getExchangeRates } from '@/api/cardApi'
import { cn } from '@/services/utils'

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

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [buyRate, setBuyRate] = useState<number | null>(null)
  const [sellRate, setSellRate] = useState<number | null>(null)
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<number | null>(null)
  const [accountsError, setAccountsError] = useState('')
  const [activityVersion, setActivityVersion] = useState(0)
  const transferFormRef = useRef<HTMLDivElement | null>(null)
  const hasSingleAccount = accounts.length === 1
  const hasTwoAccounts = accounts.length >= 2
  const mainAccount = accounts.find((account) => account.is_main) ?? accounts[0] ?? null
  const primaryCurrency = mainAccount?.currency ?? null

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

  useEffect(() => {
    if (!window.localStorage.getItem('merehbank_access_token')) {
      window.location.replace('/login')
      return
    }

    void loadAccounts()

    const fetchRates = async () => {
      try {
        const rates = await getExchangeRates()
        setBuyRate(rates.buyRate)
        setSellRate(rates.sellRate)
        setRatesUpdatedAt(rates.updatedAt)
      } catch (e) {
        // ignore, keep defaults
        // console.debug('failed fetching fx rates', e)
      }
    }

    void fetchRates()

    const intervalId = window.setInterval(() => {
      void fetchRates()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

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
    window.location.assign('/dashboard')
  }

  const handleTransferSuccess = async () => {
    await loadAccounts()
    setActivityVersion((current) => current + 1)
  }

  const handleOpenTransferForm = () => {
    transferFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleOpenReceivePage = (accountNumber: string) => {
    window.location.assign(`/dashboard/receive?account=${encodeURIComponent(accountNumber)}`)
  }

  if (!window.localStorage.getItem('merehbank_access_token')) {
    return null
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
          <section>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              {hasSingleAccount ? 'Mon compte' : 'Mes comptes'}
            </h2>

            {accountsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {accountsError}
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Aucun compte disponible pour le moment.
              </div>
            ) : hasSingleAccount ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <AccountCard
                    key={accounts[0].id}
                    currency={accounts[0].currency}
                    balance={Number(accounts[0].balance)}
                    accountNumber={accounts[0].account_number}
                    isMain={accounts[0].is_main}
                    layout="single"
                    onOpenDetails={() =>
                      window.location.assign(
                        `/dashboard/account/${encodeURIComponent(accounts[0].account_number)}`
                      )
                    }
                    onSendMoney={handleOpenTransferForm}
                    onReceiveMoney={handleOpenReceivePage}
                  />
                </div>
                <ExchangeRate
                  buyRate={buyRate}
                  sellRate={sellRate}
                  updatedAt={ratesUpdatedAt}
                  className="h-full"
                />
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-4',
                  hasTwoAccounts ? 'sm:grid-cols-2' : 'max-w-2xl'
                )}
              >
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    currency={account.currency}
                    balance={Number(account.balance)}
                    accountNumber={account.account_number}
                    isMain={account.is_main}
                    layout="dual"
                    onOpenDetails={() =>
                      window.location.assign(
                        `/dashboard/account/${encodeURIComponent(account.account_number)}`
                      )
                    }
                    onSendMoney={handleOpenTransferForm}
                    onReceiveMoney={handleOpenReceivePage}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <QuickActions />
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TransactionList
                accounts={accounts}
                refreshKey={activityVersion}
              />
            </div>

            <div ref={transferFormRef} className="space-y-6">
              {!hasSingleAccount && (
                <ExchangeRate
                  buyRate={buyRate}
                  sellRate={sellRate}
                  updatedAt={ratesUpdatedAt}
                />
              )}
              <TransferForm
                accounts={accounts}
                onTransferSuccess={handleTransferSuccess}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
