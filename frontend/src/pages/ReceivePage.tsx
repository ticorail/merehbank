import { useEffect, useState } from 'react'
import { ArrowLeft, Mail, FileText, HandCoins, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/navigation'
import { getAccounts } from '@/api/accountApi'
import { createMoneyRequest } from '@/api/notificationApi'

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

export default function ReceivePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState('')
  const [requestError, setRequestError] = useState('')
  const [selectedAccountNumber, setSelectedAccountNumber] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestAmount, setRequestAmount] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [chequeSuccess, setChequeSuccess] = useState('')
  const [chequeFileName, setChequeFileName] = useState('')
  const selectedAccount = accounts.find((account) => account.account_number === selectedAccountNumber) ?? null
  const queryAccountNumber = new URLSearchParams(window.location.search).get('account')?.trim() ?? ''

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

  useEffect(() => {
    if (accounts.length === 0) {
      return
    }

    if (selectedAccountNumber && accounts.some((account) => account.account_number === selectedAccountNumber)) {
      return
    }

    const defaultAccountNumber =
      (queryAccountNumber && accounts.some((account) => account.account_number === queryAccountNumber)
        ? queryAccountNumber
        : accounts.find((account) => account.is_main)?.account_number) ?? accounts[0]?.account_number ?? ''

    setSelectedAccountNumber(defaultAccountNumber)
  }, [accounts, queryAccountNumber, selectedAccountNumber])

  if (!window.localStorage.getItem('merehbank_access_token')) {
    return null
  }

  const primaryCurrency = selectedAccount?.currency ?? accounts.find((account) => account.is_main)?.currency ?? accounts[0]?.currency ?? null

  const handleOpenSecondaryAccount = async () => {
    window.location.assign('/dashboard/receive')
  }

  const handleMoneyRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const accessToken = window.localStorage.getItem('merehbank_access_token')
    if (!accessToken) {
      window.location.replace('/login')
      return
    }

    setChequeSuccess('')
    setRequestSuccess('')
    setRequestError('')

    if (!selectedAccount) {
      setRequestError('Sélectionnez d’abord un compte source.')
      return
    }

    try {
      const payload = await createMoneyRequest({
        debtor_email: requestEmail,
        source_account_number: selectedAccount.account_number,
        amount: requestAmount,
        message: requestMessage,
      })

      setRequestSuccess(
        typeof payload?.message === 'string'
          ? payload.message
          : 'Demande envoyée avec succès.'
      )
      setRequestEmail('')
      setRequestAmount('')
      setRequestMessage('')
      void loadAccounts()
    } catch {
      setRequestError('Impossible d’envoyer la demande pour le moment.')
    }
  }

  const handleChequeDeposit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestSuccess('')
    setChequeSuccess('Dépôt par chèque préparé. Le branchement backend viendra ensuite.')
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
              <h1 className="text-2xl font-semibold">Recevoir</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choisissez comment recevoir de l’argent ou préparer un dépôt.
              </p>
            </div>

            {accountsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {accountsError}
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Demander de l’argent</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Demander à un client de la même banque en utilisant son adresse email.
                    </p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleMoneyRequest}>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Compte source</label>
                    <select
                      value={selectedAccountNumber}
                      onChange={(event) => setSelectedAccountNumber(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.account_number}>
                          {account.account_number} • {account.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email du client</label>
                    <input
                      type="email"
                      required
                      placeholder="client@exemple.com"
                      value={requestEmail}
                      onChange={(event) => setRequestEmail(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Montant</label>
                    <input
                      type="text"
                      required
                      inputMode="decimal"
                      placeholder="100.00"
                      value={requestAmount}
                      onChange={(event) => setRequestAmount(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Message</label>
                    <textarea
                      rows={3}
                      placeholder="Expliquez pourquoi vous faites la demande"
                      value={requestMessage}
                      onChange={(event) => setRequestMessage(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <HandCoins className="h-4 w-4" />
                    Envoyer la demande
                  </button>
                </form>

                {requestSuccess ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {requestSuccess}
                  </div>
                ) : null}

                {requestError ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {requestError}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Dépôt par chèque</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Préparez un dépôt par chèque avec les informations du bénéficiaire.
                    </p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleChequeDeposit}>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Compte de dépôt</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedAccount ? `${selectedAccount.account_number} • ${selectedAccount.currency}` : 'Aucun compte sélectionné'}
                      className="mt-1 w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Photo ou PDF du chèque</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        setChequeFileName(file ? file.name : '')
                      }}
                      className="mt-1 block w-full rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Formats acceptés: image ou PDF.
                    </p>
                    {chequeFileName ? (
                      <p className="mt-2 text-sm text-foreground">Fichier sélectionné: {chequeFileName}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Numéro de chèque</label>
                    <input
                      type="text"
                      required
                      placeholder="CHQ-000123"
                      className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Montant du chèque</label>
                    <input
                      type="text"
                      required
                      inputMode="decimal"
                      placeholder="250.00"
                      className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80"
                  >
                    <FileText className="h-4 w-4" />
                    Préparer le dépôt
                  </button>
                </form>

                {chequeSuccess ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {chequeSuccess}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}