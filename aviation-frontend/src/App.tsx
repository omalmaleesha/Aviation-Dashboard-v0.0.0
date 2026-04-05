import { useCallback, useEffect, useState } from 'react'
import { Dashboard } from './Dashboard'
import { AuthPage } from './components/AuthPage'
import {
  clearAuthSession,
  getStoredAuthSession,
  saveAuthSession,
} from './auth/session'
import type { AuthSuccessResponse } from './types/auth'
import './index.css'

function App() {
  const [session, setSession] = useState<AuthSuccessResponse | null>(() => getStoredAuthSession())

  const handleAuthenticated = useCallback((nextSession: AuthSuccessResponse) => {
    saveAuthSession(nextSession)
    setSession(nextSession)
  }, [])

  const handleLogout = useCallback(() => {
    clearAuthSession()
    setSession(null)
  }, [])

  useEffect(() => {
    if (!session) return
    const timeout = window.setTimeout(() => {
      clearAuthSession()
      setSession(null)
    }, session.expires_in * 1000)

    return () => window.clearTimeout(timeout)
  }, [session])

  if (!session) {
    return <AuthPage onAuthenticated={handleAuthenticated} />
  }

  return <Dashboard onLogout={handleLogout} />
}

export default App
