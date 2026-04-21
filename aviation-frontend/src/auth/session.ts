import type { AuthSuccessResponse } from '../types/auth';

const AUTH_SESSION_STORAGE_KEY = 'aviation_auth_session';

export type AuthScope = 'user' | 'admin';

export interface AuthSession extends AuthSuccessResponse {
  auth_scope: AuthScope;
}

interface StoredAuthSession extends AuthSession {
  stored_at: number;
}

function isSessionExpired(session: StoredAuthSession): boolean {
  const expiresAt = session.stored_at + session.expires_in * 1000;
  return Date.now() >= expiresAt;
}

export function saveAuthSession(session: AuthSuccessResponse, authScope: AuthScope = 'user'): void {
  const payload: StoredAuthSession = {
    ...session,
    auth_scope: authScope,
    stored_at: Date.now(),
  };
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearAuthSession(): void {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export function getStoredAuthSession(): AuthSession | null {
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (
      !parsed?.access_token ||
      typeof parsed.expires_in !== 'number' ||
      !parsed.user?.email ||
      (parsed.auth_scope !== 'user' && parsed.auth_scope !== 'admin')
    ) {
      clearAuthSession();
      return null;
    }

    if (isSessionExpired(parsed)) {
      clearAuthSession();
      return null;
    }

    return {
      access_token: parsed.access_token,
      token_type: parsed.token_type,
      expires_in: parsed.expires_in,
      user: parsed.user,
      auth_scope: parsed.auth_scope,
    };
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAuthToken(): string | null {
  return getStoredAuthSession()?.access_token ?? null;
}
