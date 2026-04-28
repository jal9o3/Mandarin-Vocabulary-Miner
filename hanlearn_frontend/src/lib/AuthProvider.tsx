import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { AuthContext, requestAuthState } from './auth'
import type { AuthContextValue, AuthStatus, RefreshAuthOptions } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [username, setUsernameState] = useState<string | null>(null)
  const hasLoadedInitialAuth = useRef(false)

  const setAuthenticated = useCallback((nextUsername?: string | null) => {
    setStatus('authenticated')
    setUsernameState(nextUsername ?? null)
  }, [])

  const setAnonymous = useCallback(() => {
    setStatus('anonymous')
    setUsernameState(null)
  }, [])

  const setUsername = useCallback((nextUsername: string) => {
    setStatus('authenticated')
    setUsernameState(nextUsername)
  }, [])

  const refreshAuth = useCallback(async (options?: RefreshAuthOptions) => {
    if (!options?.background) {
      setStatus('loading')
    }

    try {
      const authState = await requestAuthState()

      if (!authState.ok || !authState.isAuthenticated) {
        setAnonymous()
        return false
      }

      setAuthenticated(authState.username)
      return true
    } catch {
      setStatus('error')
      setUsernameState(null)
      return false
    }
  }, [setAnonymous, setAuthenticated])

  useEffect(() => {
    if (hasLoadedInitialAuth.current) {
      return
    }

    hasLoadedInitialAuth.current = true
    const abortController = new AbortController()

    const loadInitialAuth = async () => {
      try {
        const authState = await requestAuthState(abortController.signal)

        if (!authState.ok || !authState.isAuthenticated) {
          setAnonymous()
          return
        }

        setAuthenticated(authState.username)
      } catch {
        if (abortController.signal.aborted) {
          return
        }

        setStatus('error')
        setUsernameState(null)
      }
    }

    void loadInitialAuth()

    return () => {
      abortController.abort()
    }
  }, [setAnonymous, setAuthenticated])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    isAuthenticated: status === 'authenticated',
    username,
    refreshAuth,
    setAuthenticated,
    setAnonymous,
    setUsername,
  }), [refreshAuth, setAnonymous, setAuthenticated, setUsername, status, username])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}