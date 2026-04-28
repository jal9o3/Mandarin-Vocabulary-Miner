import { createContext, useContext } from 'react'

import { API_BASE_URL } from './apiBase'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export type RefreshAuthOptions = {
  background?: boolean
}

export type AuthContextValue = {
  status: AuthStatus
  isAuthenticated: boolean
  username: string | null
  refreshAuth: (options?: RefreshAuthOptions) => Promise<boolean>
  setAuthenticated: (username?: string | null) => void
  setAnonymous: () => void
  setUsername: (username: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export async function requestAuthState(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    return {
      ok: false,
      isAuthenticated: false,
      username: null,
    }
  }

  const payload = (await response.json()) as {
    is_authenticated?: unknown
    username?: unknown
  }

  return {
    ok: true,
    isAuthenticated: payload.is_authenticated === true,
    username: typeof payload.username === 'string' ? payload.username : null,
  }
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }

  return context
}