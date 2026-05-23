"use client"

import {
  Home,
  CreditCard,
  ArrowLeftRight,
  History,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Plus,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/services/utils"
import { logoutUser } from '@/api/authApi'
import { acceptMoneyRequest, getNotifications, rejectMoneyRequest } from '@/api/notificationApi'

const navItems = [
  { icon: Home, label: "Tableau de bord", href: "/dashboard" },
  { icon: CreditCard, label: "Mes comptes", href: "/dashboard/accounts" },
  { icon: ArrowLeftRight, label: "Transferts", href: "/dashboard/transfers" },
  { icon: History, label: "Historique", href: "/dashboard/history" },
  { icon: Settings, label: "Paramètres", href: "/dashboard/settings" },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  primaryCurrency?: 'HTG' | 'USD' | null
  canOpenSecondaryAccount?: boolean
  onOpenSecondaryAccount?: () => Promise<void> | void
}

type NotificationApi = {
  id: number
  message: string
  date: string
  title?: string
  type?: string
  read?: boolean
  request_id?: number
  requester_name?: string
  requester_email?: string
  requester_account_number?: string
  amount?: string
  currency?: 'HTG' | 'USD'
  request_message?: string
}

type NotificationItem = {
  id: number
  title?: string
  message: string
  date: string
  read: boolean
  type?: string
  request_id?: number
  requester_name?: string
  requester_email?: string
  requester_account_number?: string
  amount?: string
  currency?: 'HTG' | 'USD'
  request_message?: string
}

function loadIdList(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : []
  } catch {
    return []
  }
}

function saveIdList(storageKey: string, values: number[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(values))
}

export function Sidebar({
  isOpen,
  onClose,
  primaryCurrency,
  canOpenSecondaryAccount = false,
  onOpenSecondaryAccount,
}: SidebarProps) {
  const currentPath = window.location.pathname
  const [userName, setUserName] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState<string>('')
  const [isOpeningAccount, setIsOpeningAccount] = useState(false)
  const [openAccountError, setOpenAccountError] = useState('')
  const secondaryAccountLabel =
    primaryCurrency === 'USD' ? 'Ouvrir un compte HTG' : 'Ouvrir un compte USD'

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('merehbank_user')
      if (!raw) return
      const u = JSON.parse(raw)
      const first = (u.first_name || u.firstName || '').toString().trim()
      const last = (u.last_name || u.lastName || '').toString().trim()
      const display = first || last ? `${first} ${last}`.trim() : (u.email || '')
      setUserName(display || null)
      const initials = (first || last)
        ? ((first[0] || '') + (last[0] || '')).toUpperCase()
        : (u.email ? u.email[0].toUpperCase() : '')
      setUserInitials(initials)
    } catch {
      // ignore parse errors
    }
  }, [])

  const handleOpenSecondaryAccount = async () => {
    if (!onOpenSecondaryAccount || isOpeningAccount) {
      return
    }

    setIsOpeningAccount(true)
    setOpenAccountError('')

    try {
      await onOpenSecondaryAccount()
    } catch (error) {
      setOpenAccountError(
        error instanceof Error
          ? error.message
          : "Impossible d'ouvrir ce compte pour le moment."
      )
    } finally {
      setIsOpeningAccount(false)
    }
  }

  const isActiveNavItem = (href: string) => {
    if (href === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/dashboard/'
    }

    return currentPath === href || currentPath.startsWith(`${href}/`)
  }
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
                <span className="text-lg font-bold text-sidebar-primary-foreground">M</span>
              </div>
              <span className="text-xl font-bold">Mereh</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-sidebar-accent lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  isActiveNavItem(item.href)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </a>
            ))}

            {canOpenSecondaryAccount && (
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={() => void handleOpenSecondaryAccount()}
                  disabled={isOpeningAccount}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-sidebar-primary/50 bg-sidebar-primary/8 px-4 py-3 text-sm font-medium text-sidebar-primary transition-colors hover:bg-sidebar-primary/14 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-primary/40">
                    <Plus className="h-4 w-4" />
                  </div>
                  {isOpeningAccount ? 'Ouverture en cours...' : secondaryAccountLabel}
                </button>

                {openAccountError && (
                  <p className="px-1 text-xs text-red-300">{openAccountError}</p>
                )}
              </div>
            )}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent">
                <span className="text-sm font-medium">{userInitials || 'U'}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{userName || 'Utilisateur'}</p>
                <p className="text-xs text-sidebar-foreground/60">Compte Premium</p>
              </div>
              <button
                onClick={() => {
                  try {
                    void logoutUser()
                  } catch {
                    // no-op
                  }
                }}
                className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

interface HeaderProps {
  primaryCurrency?: 'HTG' | 'USD' | null
  canOpenSecondaryAccount?: boolean
  onOpenSecondaryAccount?: () => Promise<void> | void
}

export function Header({
  primaryCurrency = null,
  canOpenSecondaryAccount = false,
  onOpenSecondaryAccount,
}: HeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [greetingName, setGreetingName] = useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsError, setNotificationsError] = useState('')
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null)
  const readIdsStorageKey = 'merehbank_notification_read_ids'
  const deletedIdsStorageKey = 'merehbank_notification_deleted_ids'

  const loadNotifications = async () => {
    const accessToken = window.localStorage.getItem('merehbank_access_token')
    if (!accessToken) {
      return
    }

    try {
      const payload = await getNotifications()
      if (!Array.isArray(payload)) {
        setNotificationsError('Réponse invalide du serveur.')
        return
      }

      const readIds = new Set(loadIdList(readIdsStorageKey))
      const deletedIds = new Set(loadIdList(deletedIdsStorageKey))

      const incomingNotifications = (payload as NotificationApi[])
        .filter((transaction) => !deletedIds.has(transaction.id))
        .map((transaction) => ({
          id: transaction.id,
          title: transaction.title,
          message: transaction.message,
          date: transaction.date,
          read: Boolean(transaction.read) || readIds.has(transaction.id),
          type: transaction.type,
          request_id: transaction.request_id,
          requester_name: transaction.requester_name,
          requester_email: transaction.requester_email,
          requester_account_number: transaction.requester_account_number,
          amount: transaction.amount,
          currency: transaction.currency,
          request_message: transaction.request_message,
        }))
        .slice(0, 6)

      setNotifications(incomingNotifications)
      setNotificationsError('')
    } catch {
      setNotificationsError('Impossible de charger les notifications pour le moment.')
    }
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('merehbank_user')
      if (!raw) return
      const u = JSON.parse(raw)
      const first = (u.first_name || u.firstName || '').toString().trim()
      setGreetingName(first || (u.email || null))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadNotifications()

    const intervalId = window.setInterval(() => {
      void loadNotifications()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markNotificationAsRead = (notificationId: number) => {
    const nextReadIds = Array.from(new Set([...loadIdList(readIdsStorageKey), notificationId]))
    saveIdList(readIdsStorageKey, nextReadIds)
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    )
  }

  const deleteNotification = (notificationId: number) => {
    const nextDeletedIds = Array.from(new Set([...loadIdList(deletedIdsStorageKey), notificationId]))
    saveIdList(deletedIdsStorageKey, nextDeletedIds)
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId))
  }

  const handleAcceptMoneyRequest = async (notification: NotificationItem & NotificationApi) => {
    if (typeof notification.request_id !== 'number') {
      return
    }

    try {
      const payload = (await acceptMoneyRequest(notification.request_id)) as Record<string, unknown> | null

      const transfer = payload?.transfer as Record<string, unknown> | undefined
      if (!transfer || typeof transfer !== 'object') {
        throw new Error('Réponse invalide du serveur.')
      }

      window.sessionStorage.setItem(
        'merehbank_money_request_prefill',
        JSON.stringify({
          requestId: notification.request_id,
          requesterName: notification.requester_name ?? '',
          requesterEmail: notification.requester_email ?? '',
          requesterAccountNumber: notification.requester_account_number ?? '',
          amount: typeof transfer.amount === 'string' ? transfer.amount : notification.amount ?? '',
          currency: (typeof transfer.currency === 'string' ? transfer.currency : notification.currency) ?? 'USD',
          message: typeof transfer.message === 'string' ? transfer.message : notification.request_message ?? '',
        })
      )

      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      window.location.assign('/dashboard/transfers?money-request=accepted')
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : 'Impossible de traiter cette demande pour le moment.'
      )
    }
  }

  const handleRejectMoneyRequest = async (notification: NotificationItem & NotificationApi) => {
    if (typeof notification.request_id !== 'number') {
      return
    }

    try {
      await rejectMoneyRequest(notification.request_id)

      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      void loadNotifications()
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : 'Impossible de traiter cette demande pour le moment.'
      )
    }
  }

  const markAllNotificationsAsRead = () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id)
    if (unreadIds.length === 0) {
      return
    }

    const nextReadIds = Array.from(new Set([...loadIdList(readIdsStorageKey), ...unreadIds]))
    saveIdList(readIdsStorageKey, nextReadIds)
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        primaryCurrency={primaryCurrency}
        canOpenSecondaryAccount={canOpenSecondaryAccount}
        onOpenSecondaryAccount={onOpenSecondaryAccount}
      />
      
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md lg:ml-64">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 hover:bg-secondary lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">Bonjour, {greetingName || 'Jean'} 👋</h1>
              <p className="text-sm text-muted-foreground">Bienvenue sur votre espace bancaire</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={notificationsPanelRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="relative rounded-lg p-2 hover:bg-secondary"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-border bg-card p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={unreadCount === 0}
                      >
                        Tout lire
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 max-h-80 overflow-auto pr-1">
                    {notificationsError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {notificationsError}
                      </p>
                    ) : notifications.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-3 py-4 text-sm text-muted-foreground">
                        Aucune notification pour le moment.
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            "rounded-xl border px-3 py-3 transition-colors",
                            notification.read
                              ? "border-border bg-secondary/10"
                              : "border-primary/20 bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => markNotificationAsRead(notification.id)}
                              className="flex-1 text-left"
                            >
                              {notification.title ? (
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                                  {notification.title}
                                </p>
                              ) : null}
                              <p
                                className={cn(
                                  "text-sm",
                                  notification.read ? "font-normal text-muted-foreground" : "font-semibold"
                                )}
                              >
                                {notification.message}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">{notification.date}</p>
                            </button>
                            {notification.type === 'money_request' ? (
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleAcceptMoneyRequest(notification as NotificationItem & NotificationApi)}
                                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                  Accepter
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRejectMoneyRequest(notification as NotificationItem & NotificationApi)}
                                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                                >
                                  Refuser
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => deleteNotification(notification.id)}
                                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
