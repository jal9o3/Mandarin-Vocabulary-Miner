import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { AuthContext, requestAuthState } from './auth'
import type { AuthContextValue, AuthStatus, RefreshAuthOptions } from './auth'

const AUTH_TIMEOUT_MS = 5000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [username, setUsernameState] = useState<string | null>(null)
  const hasLoadedInitialAuth = useRef(false)
  const [initAuthTimedOut, setInitAuthTimedOut] = useState(false)
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
    initAuthControllerRef.current = abortController

    setInitAuthTimedOut(false)
    initAuthTimerRef.current = window.setTimeout(() => setInitAuthTimedOut(true), AUTH_TIMEOUT_MS)

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
      } finally {
        if (initAuthTimerRef.current != null) {
          window.clearTimeout(initAuthTimerRef.current)
          initAuthTimerRef.current = null
        }
        setInitAuthTimedOut(false)
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

  const handleRetryInitialAuth = useCallback(() => {
    // Reset so the effect guard allows a re-run
    hasLoadedInitialAuth.current = false
    setStatus('loading')
    setInitAuthTimedOut(false)

    const abortController = new AbortController()
    initAuthControllerRef.current?.abort()
    initAuthControllerRef.current = abortController

    initAuthTimerRef.current = window.setTimeout(() => setInitAuthTimedOut(true), AUTH_TIMEOUT_MS)

    const loadInitialAuth = async () => {
      try {
        const authState = await requestAuthState(abortController.signal)
        if (!authState.ok || !authState.isAuthenticated) {
          setAnonymous()
          return
        }
        setAuthenticated(authState.username)
      } catch {
        if (abortController.signal.aborted) return
        setStatus('error')
        setUsernameState(null)
      } finally {
        if (initAuthTimerRef.current != null) {
          window.clearTimeout(initAuthTimerRef.current)
          initAuthTimerRef.current = null
        }
        setInitAuthTimedOut(false)
      }
    }

    hasLoadedInitialAuth.current = true
    void loadInitialAuth()
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

  if (status === 'loading' && initAuthTimedOut) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fffbf4] px-6 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d1451b] border-t-transparent" />
          <p className="text-base font-semibold text-[#5b4f46]">
            Taking longer than expected to connect…
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRetryInitialAuth}
              className="rounded-xl bg-[#d1451b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setAnonymous()}
              className="rounded-xl border border-[#d1451b] px-5 py-2.5 text-sm font-semibold text-[#d1451b] transition hover:bg-[#fff0ec]"
            >
              Continue without signing in
            </button>
          </div>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}