import { useEffect, useState } from 'react'
import { Eye, EyeOff, ArrowLeft, Lock, Mail, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getApiErrorPayload, storeAuthTokens } from '@/api/axios'
import { loginUser, registerUser } from '@/api/authApi'
import '@/styles/modern-bank.css'

type MainCurrency = 'HTG' | 'USD'

type RegisterFormData = {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirm: string
  main_currency: MainCurrency
  terms: boolean
}

type RegisterField = keyof RegisterFormData
type RegisterErrors = Partial<Record<RegisterField | 'non_field_errors', string>>
type LoginErrors = Partial<Record<'email' | 'password' | 'non_field_errors', string>>

const NAME_REGEX = /^[A-Za-zÀ-ÿ]+(?:[ -][A-Za-zÀ-ÿ]+)*$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9]/
const MAIN_CURRENCY_OPTIONS: Array<{
  value: MainCurrency
  label: string
  description: string
}> = [
  {
    value: 'HTG',
    label: 'HTG',
    description: "La gourde vous permet de faire des opérations à l'échelle nationale.",
  },
  {
    value: 'USD',
    label: 'USD',
    description: "Le dollar américain est adapté si vous comptez acheter à l'international.",
  },
]

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [registerForm, setRegisterForm] = useState<RegisterFormData>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirm: '',
    main_currency: 'HTG',
    terms: false,
  })
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({})
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({})
  const [registerSuccess, setRegisterSuccess] = useState('')

  useEffect(() => {
    if (window.localStorage.getItem('merehbank_access_token')) {
      window.location.assign('/dashboard')
    }
  }, [])

  const getInputClassName = (field?: string, errors: Record<string, string | undefined> = registerErrors) =>
    `w-full px-4 py-3 bg-card border rounded-lg focus:outline-none focus:ring-2 transition-colors text-foreground placeholder:text-muted-foreground ${
      field && errors[field]
        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
        : 'border-border focus:ring-primary/20 focus:border-primary'
    }`

  const getIconInputClassName = (field?: string, errors: Record<string, string | undefined> = registerErrors) =>
    `w-full pl-11 py-3 bg-card border rounded-lg focus:outline-none focus:ring-2 transition-colors text-foreground placeholder:text-muted-foreground ${
      field && errors[field]
        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
        : 'border-border focus:ring-primary/20 focus:border-primary'
    }`

  const setFieldValue = <K extends RegisterField>(field: K, value: RegisterFormData[K]) => {
    setRegisterForm((current) => ({ ...current, [field]: value }))
    setRegisterErrors((current) => ({ ...current, [field]: undefined, non_field_errors: undefined }))
    setRegisterSuccess('')
  }

  const validateLoginForm = () => {
    const errors: LoginErrors = {}
    const email = loginForm.email.trim().toLowerCase()

    if (!email) {
      errors.email = "L'adresse email est requise."
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "Le format de l'adresse email est invalide."
    }

    if (!loginForm.password) {
      errors.password = 'Le mot de passe est requis.'
    } else if (loginForm.password.length < 8) {
      errors.password = 'Le mot de passe doit contenir au moins 8 caractères.'
    }

    setLoginErrors(errors)
    return {
      isValid: Object.keys(errors).length === 0,
      normalizedData: {
        email,
        password: loginForm.password,
      },
    }
  }

  const validateRegisterForm = () => {
    const errors: RegisterErrors = {}
    const firstName = registerForm.first_name.trim()
    const lastName = registerForm.last_name.trim()
    const email = registerForm.email.trim().toLowerCase()

    if (!firstName) {
      errors.first_name = 'Le prénom est requis.'
    } else if (firstName.length < 2 || firstName.length > 50) {
      errors.first_name = 'Le prénom doit contenir entre 2 et 50 caractères.'
    } else if (!NAME_REGEX.test(firstName)) {
      errors.first_name = 'Le prénom ne peut contenir que des lettres, espaces et tirets.'
    }

    if (!lastName) {
      errors.last_name = 'Le nom est requis.'
    } else if (lastName.length < 2 || lastName.length > 50) {
      errors.last_name = 'Le nom doit contenir entre 2 et 50 caractères.'
    } else if (!NAME_REGEX.test(lastName)) {
      errors.last_name = 'Le nom ne peut contenir que des lettres, espaces et tirets.'
    }

    if (!email) {
      errors.email = "L'adresse email est requise."
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "Le format de l'adresse email est invalide."
    }

    if (!registerForm.password) {
      errors.password = 'Le mot de passe est requis.'
    } else if (registerForm.password.length < 8) {
      errors.password = 'Le mot de passe doit contenir au moins 8 caractères.'
    } else if (!/[A-Z]/.test(registerForm.password)) {
      errors.password = 'Le mot de passe doit contenir au moins une majuscule.'
    } else if (!/[a-z]/.test(registerForm.password)) {
      errors.password = 'Le mot de passe doit contenir au moins une minuscule.'
    } else if (!/\d/.test(registerForm.password)) {
      errors.password = 'Le mot de passe doit contenir au moins un chiffre.'
    } else if (!PASSWORD_SPECIAL_REGEX.test(registerForm.password)) {
      errors.password = 'Le mot de passe doit contenir au moins un caractère spécial.'
    }

    if (!registerForm.password_confirm) {
      errors.password_confirm = 'La confirmation du mot de passe est requise.'
    } else if (registerForm.password_confirm !== registerForm.password) {
      errors.password_confirm = 'La confirmation du mot de passe ne correspond pas.'
    }

    if (!registerForm.main_currency) {
      errors.main_currency = 'Veuillez choisir une devise principale.'
    }

    if (!registerForm.terms) {
      errors.terms = 'Vous devez accepter les conditions générales.'
    }

    setRegisterErrors(errors)
    return {
      isValid: Object.keys(errors).length === 0,
      normalizedData: {
        first_name: firstName,
        last_name: lastName,
        email,
        main_currency: registerForm.main_currency,
      },
    }
  }

  const mapBackendErrors = (payload: unknown): RegisterErrors => {
    if (!payload || typeof payload !== 'object') {
      return { non_field_errors: "Une erreur est survenue pendant l'inscription." }
    }

    const nextErrors: RegisterErrors = {}

    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const message = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : ''
      if (!message) {
        continue
      }

      if (
        key === 'first_name' ||
        key === 'last_name' ||
        key === 'email' ||
        key === 'password' ||
        key === 'password_confirm' ||
        key === 'main_currency' ||
        key === 'terms'
      ) {
        nextErrors[key] = message
      } else if (key === 'non_field_errors' || key === 'detail') {
        nextErrors.non_field_errors = message
      }
    }

    if (Object.keys(nextErrors).length === 0) {
      nextErrors.non_field_errors = "Une erreur est survenue pendant l'inscription."
    }

    return nextErrors
  }

  const mapLoginBackendErrors = (payload: unknown): LoginErrors => {
    if (!payload || typeof payload !== 'object') {
      return { non_field_errors: 'Une erreur est survenue pendant la connexion.' }
    }

    const nextErrors: LoginErrors = {}

    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const message = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : ''
      if (!message) {
        continue
      }

      if (key === 'email' || key === 'password') {
        nextErrors[key] = message
      } else if (key === 'non_field_errors' || key === 'detail') {
        nextErrors.non_field_errors = message
      }
    }

    if (Object.keys(nextErrors).length === 0) {
      nextErrors.non_field_errors = 'Une erreur est survenue pendant la connexion.'
    }

    return nextErrors
  }

  const handleTabChange = (tab: 'login' | 'register') => {
    setActiveTab(tab)
    setRegisterErrors({})
    setLoginErrors({})
    setRegisterSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (activeTab === 'login') {
      const { isValid, normalizedData } = validateLoginForm()
      if (!isValid) {
        return
      }

      setIsLoading(true)

      try {
        const payload = await loginUser(normalizedData)

        if (typeof payload?.access !== 'string') {
          setLoginErrors({ non_field_errors: 'Réponse de connexion invalide du serveur.' })
          return
        }

        storeAuthTokens({
          access: payload.access,
          user: payload.user,
        })

        window.location.assign('/dashboard')
      } catch (error) {
        setLoginErrors(mapLoginBackendErrors(getApiErrorPayload(error)))
      } finally {
        setIsLoading(false)
      }

      return
    }

    const { isValid, normalizedData } = validateRegisterForm()
    if (!isValid) {
      return
    }

    setIsLoading(true)
    setRegisterSuccess('')

    try {
      const payload = await registerUser({
        ...normalizedData,
        password: registerForm.password,
        password_confirm: registerForm.password_confirm,
        terms: registerForm.terms,
      })

      setRegisterErrors({})
      setRegisterSuccess(
        typeof payload?.message === 'string' ? payload.message : 'Compte créé avec succès.'
      )
      setRegisterForm({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        password_confirm: '',
        main_currency: 'HTG',
        terms: false,
      })
    } catch (error) {
      setRegisterErrors(mapBackendErrors(getApiErrorPayload(error)))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-primary-foreground/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-foreground rounded-lg flex items-center justify-center">
              <span className="text-primary font-serif font-bold text-2xl">M</span>
            </div>
            <span className="font-serif text-2xl font-semibold text-primary-foreground">Banque Mereh</span>
          </a>

          {/* Message */}
          <div className="max-w-md">
            <h1 className="font-serif text-4xl xl:text-5xl font-semibold text-primary-foreground leading-tight mb-6 text-balance">
              Gérez votre avenir financier en toute sérénité
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Accédez à vos comptes, suivez vos dépenses et réalisez vos projets avec notre plateforme sécurisée.
            </p>
          </div>

          {/* Trust Badge */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 rounded-full">
              <Lock size={16} className="text-primary-foreground" />
              <span className="text-sm text-primary-foreground">Connexion 100% sécurisée</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <a href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-serif font-bold text-xl">M</span>
              </div>
              <span className="font-serif text-xl font-semibold text-foreground">Banque Mereh</span>
            </a>
          </div>

          {/* Back Link */}
          <a
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Retour à l&apos;accueil</span>
          </a>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'login'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'register'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-semibold text-foreground mb-2">
              {activeTab === 'login' ? 'Bienvenue' : 'Créer un compte'}
            </h2>
            <p className="text-muted-foreground">
              {activeTab === 'login'
                ? 'Connectez-vous à votre espace client'
                : 'Rejoignez Banque Mereh en quelques minutes'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {activeTab === 'register' && registerSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {registerSuccess}
              </div>
            )}

            {activeTab === 'register' && registerErrors.non_field_errors && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {registerErrors.non_field_errors}
              </div>
            )}

            {activeTab === 'login' && loginErrors.non_field_errors && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loginErrors.non_field_errors}
              </div>
            )}

            {activeTab === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Prénom
                  </label>
                  <input
                    type="text"
                    placeholder="Jean"
                    value={registerForm.first_name}
                    onChange={(e) => setFieldValue('first_name', e.target.value)}
                    className={getInputClassName('first_name')}
                  />
                  {registerErrors.first_name && (
                    <p className="mt-2 text-sm text-red-600">{registerErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nom
                  </label>
                  <input
                    type="text"
                    placeholder="Dupont"
                    value={registerForm.last_name}
                    onChange={(e) => setFieldValue('last_name', e.target.value)}
                    className={getInputClassName('last_name')}
                  />
                  {registerErrors.last_name && (
                    <p className="mt-2 text-sm text-red-600">{registerErrors.last_name}</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'register' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Compte principal
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MAIN_CURRENCY_OPTIONS.map((option) => {
                    const isSelected = registerForm.main_currency === option.value

                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="main_currency"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => setFieldValue('main_currency', option.value)}
                          className="sr-only"
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{option.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Devise principale
                            </p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground transition-colors hover:text-foreground"
                                aria-label={`Informations sur ${option.label}`}
                              >
                                <Info size={16} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={8} className="max-w-52">
                              {option.description}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {registerErrors.main_currency && (
                  <p className="mt-2 text-sm text-red-600">{registerErrors.main_currency}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="votre@email.fr"
                  value={activeTab === 'register' ? registerForm.email : loginForm.email}
                  onChange={(e) =>
                    activeTab === 'register'
                      ? setFieldValue('email', e.target.value)
                      : setLoginForm((current) => ({ ...current, email: e.target.value }))
                  }
                  className={`${getIconInputClassName(
                    'email',
                    activeTab === 'register' ? registerErrors : loginErrors
                  )} pr-4`}
                />
              </div>
              {activeTab === 'register' && registerErrors.email && (
                <p className="mt-2 text-sm text-red-600">{registerErrors.email}</p>
              )}
              {activeTab === 'login' && loginErrors.email && (
                <p className="mt-2 text-sm text-red-600">{loginErrors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">
                  Mot de passe
                </label>
                {activeTab === 'login' && (
                  <a href="#" className="text-sm text-primary hover:underline">
                    Mot de passe oublié ?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={activeTab === 'register' ? registerForm.password : loginForm.password}
                  onChange={(e) =>
                    activeTab === 'register'
                      ? setFieldValue('password', e.target.value)
                      : setLoginForm((current) => ({ ...current, password: e.target.value }))
                  }
                  className={`${getIconInputClassName(
                    'password',
                    activeTab === 'register' ? registerErrors : loginErrors
                  )} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {activeTab === 'register' && registerErrors.password && (
                <p className="mt-2 text-sm text-red-600">{registerErrors.password}</p>
              )}
              {activeTab === 'login' && loginErrors.password && (
                <p className="mt-2 text-sm text-red-600">{loginErrors.password}</p>
              )}
            </div>

            {activeTab === 'register' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={registerForm.password_confirm}
                    onChange={(e) => setFieldValue('password_confirm', e.target.value)}
                    className={`${getIconInputClassName('password_confirm')} pr-4`}
                  />
                </div>
                {registerErrors.password_confirm && (
                  <p className="mt-2 text-sm text-red-600">{registerErrors.password_confirm}</p>
                )}
              </div>
            )}

            {activeTab === 'login' && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <label htmlFor="remember" className="text-sm text-muted-foreground">
                  Se souvenir de moi
                </label>
              </div>
            )}

            {activeTab === 'register' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={registerForm.terms}
                  onChange={(e) => setFieldValue('terms', e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary/20"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  J&apos;accepte les{' '}
                  <a href="#" className="text-primary hover:underline">conditions générales</a>
                  {' '}et la{' '}
                  <a href="#" className="text-primary hover:underline">politique de confidentialité</a>
                </label>
              </div>
            )}
            {activeTab === 'register' && registerErrors.terms && (
              <p className="-mt-2 text-sm text-red-600">{registerErrors.terms}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Chargement...
                </span>
              ) : activeTab === 'login' ? (
                'Se connecter'
              ) : (
                "Créer mon compte"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <button type="button" className="w-full py-3 border border-border rounded-lg flex items-center justify-center gap-3 hover:bg-card transition-colors text-foreground font-medium">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </button>
          </div>

          {/* Bottom Text */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            {activeTab === 'login' ? (
              <>
                Pas encore client ?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('register')}
                  className="text-primary hover:underline font-medium"
                >
                  Ouvrir un compte
                </button>
              </>
            ) : (
              <>
                Déjà client ?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  className="text-primary hover:underline font-medium"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
