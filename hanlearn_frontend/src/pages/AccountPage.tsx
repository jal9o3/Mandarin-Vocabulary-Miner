import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { useAuth } from '../lib/auth'
import { BusyRetryBanner } from '../components/LoadingWithRetry'
import { attachTimeout, isAbortError, isBackendConnectionFailure } from '../lib/requestUtils'

type AuthMode = 'login' | 'register'

export function AccountPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  const requestedMode = useMemo<AuthMode>(() => {
    const value = new URLSearchParams(location.search).get('mode')
    return value === 'login' ? 'login' : 'register'
  }, [location.search])
  const [mode, setMode] = useState<AuthMode>(requestedMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingTimedOut, setIsSubmittingTimedOut] = useState(false)
  const [isSubmittingTimeoutExhausted, setIsSubmittingTimeoutExhausted] = useState(false)
  const submittingControllerRef = useRef<AbortController | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const readError = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as Record<string, unknown>
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error
      }
      return `${fallback} (${response.status})`
    } catch {
      return `${fallback} (${response.status})`
    }
  }

  useEffect(() => {
    setMode(requestedMode)
  }, [requestedMode])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setErrorMessage('Enter both username and password.')
      return
    }

    setIsSubmittingTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsSubmittingTimedOut, submittingControllerRef)
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedUsername, password }),
        signal: submittingControllerRef.current?.signal,
      })

      if (!response.ok) {
        throw new Error(await readError(response, 'Authentication failed'))
      }

      const isAuthenticated = await refreshAuth({ background: true })
      if (!isAuthenticated) {
        throw new Error(
          'Authentication did not persist your session cookie. Use the same host for frontend and backend (127.0.0.1 or localhost), then try again.'
        )
      }

      navigate(-1)
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsSubmittingTimedOut(true)
        return
      }
      const message = error instanceof Error ? error.message : 'Unexpected authentication error.'
      setErrorMessage(message)
    } finally {
      clearTimer()
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Create Account or Sign In</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Saving flashcards requires an account. Create one or sign in to continue.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-[#e6dbc9] bg-white p-2">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'register' ? 'bg-[#d1451b] text-white' : 'text-[#5d4a3a] hover:bg-[#fff1e5]'
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'login' ? 'bg-[#d1451b] text-white' : 'text-[#5d4a3a] hover:bg-[#fff1e5]'
            }`}
          >
            Sign in
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-[#4e4138]">
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
            />
          </label>

          <label className="block text-sm font-semibold text-[#4e4138]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
            />
          </label>

          {errorMessage ? <p className="text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || (isSubmittingTimedOut && !isSubmittingTimeoutExhausted)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {isSubmitting ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
          <BusyRetryBanner
            active={isSubmittingTimedOut}
            onExhausted={() => setIsSubmittingTimeoutExhausted(true)}
          />
        </form>
      </section>
    </main>
  )
}
