import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

type AdminUser = {
  role?: string
  is_admin?: boolean
  isAdmin?: boolean
  permissions?: string[]
}

type AdminRouteProps = {
  children?: ReactNode
}

function hasAdminAccess() {
  if (!window.localStorage.getItem('merehbank_access_token')) {
    return false
  }

  try {
    const raw = window.localStorage.getItem('merehbank_user')
    if (!raw) {
      return false
    }

    const user = JSON.parse(raw) as AdminUser
    return Boolean(
      user.is_admin ||
        user.isAdmin ||
        user.role === 'admin' ||
        user.permissions?.includes('admin')
    )
  } catch {
    return false
  }
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const location = useLocation()

  if (!hasAdminAccess()) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />
  }

  if (children) {
    return <>{children}</>
  }

  return <Outlet />
}
