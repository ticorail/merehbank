import { useEffect, useState } from 'react'
import { Landmark, Building2, ArrowLeft } from 'lucide-react'
import { Header } from '@/components/navigation'
import { getAccounts, openAccount } from '@/api/accountApi'
import { InternalTransferForm } from '@/components/internal-transfer-form'
import { TransferForm } from '@/components/transfer-form'

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

type MoneyRequestPrefill = {
  requestId: number
  requesterName: string
  requesterEmail: string
  requesterAccountNumber: string
  amount: string
  currency: 'HTG' | 'USD'
  message: string
}

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [moneyRequestPrefill, setMoneyRequestPrefill] = useState<MoneyRequestPrefill | null>(null)

  const loadCompletedRequestIds = () => {
    try {
      const raw = window.localStorage.getItem('merehbank_money_request_completed_ids')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : []
    } catch {
      return []
    }
  }

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

    try {
      const raw = window.sessionStorage.getItem('merehbank_money_request_prefill')
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as Partial<MoneyRequestPrefill>
      if (
        typeof parsed?.requestId === 'number' &&
        typeof parsed?.requesterName === 'string' &&
        typeof parsed?.requesterEmail === 'string' &&
        typeof parsed?.requesterAccountNumber === 'string' &&
        typeof parsed?.amount === 'string' &&
        (parsed?.currency === 'HTG' || parsed?.currency === 'USD') &&
        typeof parsed?.message === 'string'
      ) {
        if (loadCompletedRequestIds().includes(parsed.requestId)) {
          window.sessionStorage.removeItem('merehbank_money_request_prefill')
          return
        }

        setMoneyRequestPrefill(parsed as MoneyRequestPrefill)
      }
    } catch {
      window.sessionStorage.removeItem('merehbank_money_request_prefill')
    }
  }, [])

  if (!window.localStorage.getItem('merehbank_access_token')) {
    return null
  }

  const mainAccount = accounts.find((account) => account.is_main) ?? accounts[0] ?? null
  const primaryCurrency = mainAccount?.currency ?? null
  const prefixedSourceAccount = moneyRequestPrefill
    ? accounts.find((account) => account.currency === moneyRequestPrefill.currency)?.account_number ??
      mainAccount?.account_number ??
      accounts[0]?.account_number ??
      ''
    : undefined

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
    window.location.assign('/dashboard/transfers')
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
              <h1 className="text-2xl font-semibold">Transferts</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choisissez le type de transfert que vous voulez effectuer.
              </p>
            </div>

            {accountsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {accountsError}
              </div>
            ) : null}

            <div className={moneyRequestPrefill ? 'grid gap-6' : 'grid gap-6 lg:grid-cols-2'}>
              {!moneyRequestPrefill ? (
                <div className="rounded-3xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Entre mes comptes</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Transférez entre vos deux comptes HTG et USD avec le formulaire dédié.
                      </p>
                    </div>
                  </div>
                  <InternalTransferForm accounts={accounts} onTransferSuccess={loadAccounts} />
                </div>
              ) : null}

              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {moneyRequestPrefill ? 'Répondre à une demande' : 'Transfert vers une banque extérieure'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {moneyRequestPrefill
                        ? 'Les informations de la demande sont préremplies; vous pouvez modifier le montant avant l’envoi.'
                        : 'Ce flux est prévu pour un bénéficiaire hors de la banque et reste à brancher.'}
                    </p>
                  </div>
                </div>

                {moneyRequestPrefill ? (
                  <TransferForm
                    accounts={accounts}
                    onTransferSuccess={loadAccounts}
                    initialSourceAccountNumber={prefixedSourceAccount}
                    moneyRequestPrefill={moneyRequestPrefill}
                  />
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/20 p-5">
                    <p className="text-sm font-medium">Champs à prévoir</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Banque destinataire, numéro de compte, nom du bénéficiaire, montant et devise.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}