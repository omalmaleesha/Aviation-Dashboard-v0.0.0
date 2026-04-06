import { useCallback, useEffect, useState } from 'react'
import { Dashboard } from './Dashboard'
import { AuthPage } from './components/AuthPage'
import { AdminLoginPage } from './components/AdminLoginPage'
import { AdminDashboard } from './components/AdminDashboard'
import { fetchAdminMe } from './auth/api'
import {
  clearAuthSession,
  getStoredAuthSession,
  saveAuthSession,
  type AuthSession,
} from './auth/session'
import type { AuthSuccessResponse } from './types/auth'
import './index.css'

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession())
  const [authMode, setAuthMode] = useState<'user' | 'admin'>('user')
  const sessionScope = session?.auth_scope
  const sessionToken = session?.access_token

  const handleAuthenticated = useCallback((nextSession: AuthSuccessResponse) => {
    const shouldUseAdminScope = Boolean(nextSession.user?.is_admin)
    const authScope = shouldUseAdminScope ? 'admin' : 'user'

    saveAuthSession(nextSession, authScope)
    setSession({ ...nextSession, auth_scope: authScope })
    setAuthMode(authScope)
  }, [])

  const handleAdminAuthenticated = useCallback((nextSession: AuthSuccessResponse) => {
    saveAuthSession(nextSession, 'admin')
    setSession({ ...nextSession, auth_scope: 'admin' })
  }, [])

  const handleLogout = useCallback(() => {
    clearAuthSession()
    setSession(null)
    setAuthMode('user')
  }, [])

  const handleSwitchToUserPortal = useCallback(() => {
    if (!session) return
    const userPortalSession: AuthSession = {
      ...session,
      auth_scope: 'user',
    }
    saveAuthSession(userPortalSession, 'user')
    setSession(userPortalSession)
  }, [session])

  useEffect(() => {
    if (!session) return
    const timeout = window.setTimeout(() => {
      clearAuthSession()
      setSession(null)
    }, session.expires_in * 1000)

    return () => window.clearTimeout(timeout)
  }, [session])

  useEffect(() => {
    let cancelled = false

    async function verifyAdminSession() {
      if (sessionScope !== 'admin' || !sessionToken) return

      try {
        const user = await fetchAdminMe(sessionToken)
        if (cancelled) return

        if (!user.is_admin) {
          clearAuthSession()
          setSession(null)
          setAuthMode('admin')
          return
        }
      } catch {
        if (cancelled) return
        clearAuthSession()
        setSession(null)
        setAuthMode('admin')
      }
    }

    void verifyAdminSession()

    return () => {
      cancelled = true
    }
  }, [sessionScope, sessionToken])

  if (!session) {
    return authMode === 'admin' ? (
      <AdminLoginPage
        onAuthenticated={handleAdminAuthenticated}
        onSwitchToUserLogin={() => setAuthMode('user')}
      />
    ) : (
      <div className="relative">
        <button
          type="button"
          onClick={() => setAuthMode('admin')}
          className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-[11px] font-mono uppercase tracking-wider text-red-300 hover:bg-red-500/20"
        >
          Admin login
        </button>
        <AuthPage onAuthenticated={handleAuthenticated} />
      </div>
    )
  }

  if (session.auth_scope === 'admin') {
    if (!session.user.is_admin) {
      clearAuthSession()
      return (
        <AdminLoginPage
          onAuthenticated={handleAdminAuthenticated}
          onSwitchToUserLogin={() => setAuthMode('user')}
        />
      )
    }

    return (
      <AdminDashboard
        session={session}
        onLogout={handleLogout}
        onSwitchToUserPortal={handleSwitchToUserPortal}
      />
    )
  }

  return <Dashboard onLogout={handleLogout} />
}

export default App
