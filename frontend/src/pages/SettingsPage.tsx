import { useMemo } from 'react'
import {
  ArrowLeft,
  Cake,
  BadgeCheck,
  Globe2,
  Headphones,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserCircle2,
  Wallet,
  Edit3,
} from 'lucide-react'
import { Header } from '@/components/navigation'

type UserProfile = {
  first_name?: string
  last_name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  phone_number?: string
  address?: string
  birth_date?: string
  date_of_birth?: string
  country?: string
  currency?: 'HTG' | 'USD'
  avatar_url?: string
}

function formatValue(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'Non renseigné'
}

function formatDate(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return 'Non renseignée'
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return trimmed
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
  }).format(parsed)
}

function getInitials(profile: UserProfile) {
  const first = (profile.first_name || profile.firstName || '').trim()
  const last = (profile.last_name || profile.lastName || '').trim()
  const initials = `${first[0] || ''}${last[0] || ''}`.trim()
  if (initials) {
    return initials.toUpperCase()
  }

  const email = profile.email?.trim()
  return email ? email[0].toUpperCase() : 'U'
}

function loadProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem('merehbank_user')
    return raw ? (JSON.parse(raw) as UserProfile) : {}
  } catch {
    return {}
  }
}

export default function SettingsPage() {
  const profile = useMemo(() => loadProfile(), [])

  const fullName = [
    profile.first_name ?? profile.firstName ?? '',
    profile.last_name ?? profile.lastName ?? '',
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')

  const mainCurrency = profile.currency ?? 'HTG'
  const profileLabel = fullName || 'Profil utilisateur'

  const primaryCurrencyLabel = mainCurrency === 'USD' ? 'Dollar américain (USD)' : 'Gourde haïtienne (HTG)'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        primaryCurrency={mainCurrency}
        canOpenSecondaryAccount={false}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Paramètres</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Gérez votre profil, vos limites, votre sécurité et l’assistance depuis un espace unique.
                </p>
              </div>

              <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Compte principal</p>
                <p className="mt-1 text-sm font-medium">{primaryCurrencyLabel}</p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5 shadow-sm xl:col-span-2">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <UserCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Profil du compte</h2>
                      <p className="text-sm text-muted-foreground">
                        Informations personnelles visibles par l’utilisateur.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40"
                  >
                    <Edit3 className="h-4 w-4" />
                    Modifier les informations personnelles
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="rounded-2xl border bg-secondary/20 p-5">
                    <div className="flex flex-col items-center text-center">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Photo de profil"
                          className="h-24 w-24 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                          {getInitials(profile)}
                        </div>
                      )}
                      <p className="mt-4 text-base font-semibold">{profileLabel}</p>
                      <p className="text-sm text-muted-foreground">Photo de profil</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={formatValue(profile.email)} />
                    <DetailRow icon={<Phone className="h-4 w-4" />} label="Numéro de téléphone" value={formatValue(profile.phone ?? profile.phone_number)} />
                    <DetailRow icon={<MapPin className="h-4 w-4" />} label="Adresse" value={formatValue(profile.address)} />
                    <DetailRow icon={<Cake className="h-4 w-4" />} label="Date de naissance" value={formatDate(profile.birth_date ?? profile.date_of_birth)} />
                    <DetailRow icon={<Globe2 className="h-4 w-4" />} label="Pays / devise principale" value={`${formatValue(profile.country)} · ${primaryCurrencyLabel}`} />
                    <DetailRow icon={<BadgeCheck className="h-4 w-4" />} label="Nom complet" value={fullName || 'Non renseigné'} />
                  </div>
                </div>
              </section>

              <SettingsSection
                icon={<Wallet className="h-5 w-5" />}
                title="Limites et paiements"
                description="Consultez vos plafonds de transaction et de paiement."
                items={[
                  'Limite de transfert journalier',
                  'Limite de retrait ATM',
                  'Limite de paiement en ligne',
                ]}
              />

              <SettingsSection
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Sécurité"
                description="Contrôlez les éléments de sécurité liés à votre compte."
                items={['Vérification d’identité (KYC)', 'Historique de connexion']}
              />

              <SettingsSection
                icon={<Headphones className="h-5 w-5" />}
                title="Support et assistance"
                description="Accédez rapidement aux ressources d’aide et au support."
                items={['FAQ', 'Signaler un problème', 'Contacter le support', 'Conditions d’utilisation']}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border bg-background px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-muted p-2 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({
  icon,
  title,
  description,
  items,
}: {
  icon: React.ReactNode
  title: string
  description: string
  items: string[]
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-border/80 bg-secondary/20 px-4 py-3 text-sm font-medium text-foreground"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}
