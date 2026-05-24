import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import HistoryPage from '@/pages/HistoryPage'
import StatementsPage from '@/pages/StatementsPage'
import TransfersPage from '@/pages/TransfersPage'
import ReceivePage from '@/pages/ReceivePage'
import SettingsPage from '@/pages/SettingsPage'
import AccountDetailsPage from '@/pages/AccountDetailsPage'
import PrivateRoute from './PrivateRoute'
import AdminRoute from './AdminRoute'
import PublicLayout from '@/layouts/PublicLayout'
import DashboardLayout from '@/layouts/DashboardLayout'

function AccountDetailsRoute() {
  const { accountNumber = '' } = useParams()
  return <AccountDetailsPage accountNumber={accountNumber} />
}

function StatementsRoute() {
  const { accountNumber = '' } = useParams()
  return <StatementsPage accountNumber={accountNumber} />
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/accounts" element={<AccountsPage />} />
            <Route path="/dashboard/history" element={<HistoryPage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/transfers" element={<TransfersPage />} />
            <Route path="/dashboard/receive" element={<ReceivePage />} />
            <Route path="/dashboard/account/:accountNumber" element={<AccountDetailsRoute />} />
            <Route
              path="/dashboard/account/:accountNumber/statements"
              element={<StatementsRoute />}
            />
            <Route
              path="/dashboard/admin/*"
              element={
                <AdminRoute>
                  <Navigate to="/dashboard" replace />
                </AdminRoute>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
