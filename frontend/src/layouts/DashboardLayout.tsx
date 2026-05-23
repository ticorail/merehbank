import { Outlet } from 'react-router-dom'
import { SessionTimeoutManager } from '@/components/session-timeout-manager'

export default function DashboardLayout() {
  return (
    <>
      <Outlet />
      <SessionTimeoutManager />
    </>
  )
}
