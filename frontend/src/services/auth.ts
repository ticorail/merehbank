import { logoutUser } from '@/api/authApi'

type LogoutOptions = {
  redirectTo?: string
}

export async function logout(options: LogoutOptions = {}) {
  const { redirectTo = '/login' } = options
  await logoutUser(redirectTo)
}

export default logout
