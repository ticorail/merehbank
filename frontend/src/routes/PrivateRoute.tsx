import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

type PrivateRouteProps = {
  children?: ReactNode
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const location = useLocation()
  const hasAccessToken = Boolean(window.localStorage.getItem('merehbank_access_token'))

  if (!hasAccessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (children) {
    return <>{children}</>
  }

  return <Outlet />
}
