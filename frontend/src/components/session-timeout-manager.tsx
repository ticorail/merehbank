import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import logout from '@/services/auth'

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
const WARNING_COUNTDOWN_SECONDS = 30
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'click',
  'keydown',
  'mousedown',
  'mousemove',
  'scroll',
  'touchstart',
]

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function SessionTimeoutManager() {
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [countdown, setCountdown] = useState(WARNING_COUNTDOWN_SECONDS)
  const warningTimeoutRef = useRef<number | null>(null)
  const logoutTimeoutRef = useRef<number | null>(null)
  const countdownIntervalRef = useRef<number | null>(null)
  const isLoggingOutRef = useRef(false)

  const clearWarningTimeout = () => {
    if (warningTimeoutRef.current !== null) {
      window.clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
  }

  const clearLogoutTimeout = () => {
    if (logoutTimeoutRef.current !== null) {
      window.clearTimeout(logoutTimeoutRef.current)
      logoutTimeoutRef.current = null
    }
  }

  const clearCountdownInterval = () => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }

  const clearAllTimers = () => {
    clearWarningTimeout()
    clearLogoutTimeout()
    clearCountdownInterval()
  }

  const isProtectedSessionActive = () =>
    Boolean(window.localStorage.getItem('merehbank_access_token')) &&
    window.location.pathname.startsWith('/dashboard')

  const handleAutomaticLogout = async () => {
    if (isLoggingOutRef.current) {
      return
    }

    isLoggingOutRef.current = true
    clearAllTimers()
    setIsWarningOpen(false)
    await logout({ redirectTo: '/' })
  }

  const scheduleWarning = () => {
    clearWarningTimeout()

    if (!isProtectedSessionActive() || isLoggingOutRef.current) {
      return
    }

    warningTimeoutRef.current = window.setTimeout(() => {
      setCountdown(WARNING_COUNTDOWN_SECONDS)
      setIsWarningOpen(true)
    }, INACTIVITY_TIMEOUT_MS)
  }

  const handleContinueSession = () => {
    if (isLoggingOutRef.current) {
      return
    }

    clearLogoutTimeout()
    clearCountdownInterval()
    setCountdown(WARNING_COUNTDOWN_SECONDS)
    setIsWarningOpen(false)
    scheduleWarning()
  }

  useEffect(() => {
    if (!isProtectedSessionActive()) {
      clearAllTimers()
      setIsWarningOpen(false)
      return
    }

    const handleActivity = () => {
      if (isWarningOpen || isLoggingOutRef.current) {
        return
      }

      scheduleWarning()
    }

    scheduleWarning()
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })
      clearAllTimers()
    }
  }, [isWarningOpen])

  useEffect(() => {
    if (!isWarningOpen) {
      clearLogoutTimeout()
      clearCountdownInterval()
      return
    }

    clearLogoutTimeout()
    clearCountdownInterval()

    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    logoutTimeoutRef.current = window.setTimeout(() => {
      void handleAutomaticLogout()
    }, WARNING_COUNTDOWN_SECONDS * 1000)

    return () => {
      clearLogoutTimeout()
      clearCountdownInterval()
    }
  }, [isWarningOpen])

  useEffect(() => () => {
    clearAllTimers()
  }, [])

  if (!isProtectedSessionActive()) {
    return null
  }

  return (
    <Dialog open={isWarningOpen}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Déconnexion imminente</DialogTitle>
          <DialogDescription>
            Votre session est inactive depuis 5 minutes. Pour votre sécurité, vous serez
            automatiquement déconnecté dans {formatCountdown(countdown)} si vous ne faites rien.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Votre session va expirer. Cliquez sur le bouton ci-dessous pour continuer.
        </div>

        <DialogFooter>
          <Button type="button" className="w-full sm:w-auto" onClick={handleContinueSession}>
            Continuer la session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
