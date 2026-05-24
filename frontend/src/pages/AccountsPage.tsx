import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, CreditCard, Wallet } from 'lucide-react'
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

function maskAccountNumber(accountNumber: string) {
  if (accountNumber.length <= 4) {
    return accountNumber
  }

  return `${'*'.repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState('')
  const hasAccessToken = Boolean(window.localStorage.getItem('merehbank_access_token'))

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
  }, [])

  const sortedAccounts = useMemo(
    () => [...accounts].sort((left, right) => Number(right.is_main) - Number(left.is_main)),
    [accounts]
  )

  const mainAccount = sortedAccounts.find((account) => account.is_main) ?? sortedAccounts[0] ?? null
  const primaryCurrency = mainAccount?.currency ?? null

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
    window.location.assign('/dashboard/accounts')
  }

  if (!hasAccessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="rounded-2xl border border-border bg-card px-6 py-5 text-sm text-muted-foreground shadow-sm">
          Redirection vers la connexion...
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
              <h1 className="text-2xl font-semibold">Mes comptes</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Consultez tous vos comptes et ouvrez le détail de chacun d'eux.
              </p>
            </div>

            {accountsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {accountsError}
              </div>
            ) : null}

            {sortedAccounts.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Aucun compte disponible pour le moment.
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sortedAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() =>
                      window.location.assign(
                        `/dashboard/account/${encodeURIComponent(account.account_number)}`
                      )
                    }
                    className="group text-left"
                  >
                    <div
                      className={
                        account.currency === 'HTG'
                          ? 'relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground transition-transform group-hover:-translate-y-1'
                          : 'relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-green-400 p-6 text-emerald-50 transition-transform group-hover:-translate-y-1'
                      }
                    >
                      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                      <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-white/5" />

                      <div className="relative flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">
                              Compte {account.currency}{account.is_main ? ' principal' : ''}
                            </h2>
                          </div>
                          <p className="mt-2 text-sm opacity-75">
                            Numéro masqué: {maskAccountNumber(account.account_number)}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
                      </div>

                      <div className="relative mt-8">
                        <p className="text-sm opacity-80">Solde actuel</p>
                        <p className="mt-2 text-3xl font-bold">
                          {formatMoney(Number(account.balance), account.currency)}
                        </p>
                      </div>

                      <div className="relative mt-6 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide opacity-70">Devise</p>
                          <p className="font-medium">{account.currency}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide opacity-70">Disponible</p>
                          <p className="font-medium">
                            {formatMoney(Number(account.available_balance), account.currency)}
                          </p>
                        </div>
                      </div>

                      <div className="relative mt-4 flex items-center gap-2 text-sm font-medium opacity-90">
                        <Wallet className="h-4 w-4" />
                        Ouvrir l’historique
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
