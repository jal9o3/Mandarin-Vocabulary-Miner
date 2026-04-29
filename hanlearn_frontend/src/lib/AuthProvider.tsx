import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { isAbortError, isBackendConnectionFailure } from './requestUtils'
import { AuthContext, requestAuthState } from './auth'
import type { AuthContextValue, AuthStatus, RefreshAuthOptions } from './auth'

const AUTH_TIMEOUT_MS = 5000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [username, setUsernameState] = useState<string | null>(null)
  const hasLoadedInitialAuth = useRef(false)
  const initAuthControllerRef = useRef<AbortController | null>(null)
  const initAuthTimerRef = useRef<number | null>(null)

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
    } catch (error) {
      if (isBackendConnectionFailure(error)) {
        return false
      }
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
    initAuthControllerRef.current = abortController

    initAuthTimerRef.current = window.setTimeout(() => {
      abortController.abort()
      setAnonymous()
    }, AUTH_TIMEOUT_MS)

    const loadInitialAuth = async () => {
      try {
        const authState = await requestAuthState(abortController.signal)

        if (!authState.ok || !authState.isAuthenticated) {
          setAnonymous()
          return
        }

        setAuthenticated(authState.username)
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        if (isBackendConnectionFailure(error)) {
          setAnonymous()
          return
        }

        setStatus('error')
        setUsernameState(null)
      } finally {
        if (initAuthTimerRef.current != null) {
          window.clearTimeout(initAuthTimerRef.current)
          initAuthTimerRef.current = null
        }
      }
    }

    void loadInitialAuth()

    return () => {
      abortController.abort()
      if (initAuthTimerRef.current != null) {
        window.clearTimeout(initAuthTimerRef.current)
        initAuthTimerRef.current = null
      }
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}