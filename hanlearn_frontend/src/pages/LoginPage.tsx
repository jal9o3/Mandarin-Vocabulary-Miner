import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { useAuth } from '../lib/auth'
import { attachTimeout } from '../lib/requestUtils'
import { RetryPrompt } from '../components/LoadingWithRetry'

export function LoginPage() {
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingTimedOut, setIsSubmittingTimedOut] = useState(false)
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setErrorMessage('Enter both username and password.')
      return
    }

    const clearTimer = attachTimeout(setIsSubmittingTimedOut, submittingControllerRef)
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
        signal: submittingControllerRef.current?.signal,
      })

      if (!response.ok) {
        throw new Error(await readError(response, 'Login failed'))
      }

      // Validate session persistence immediately so failures are visible.
      const isAuthenticated = await refreshAuth({ background: true })
      if (!isAuthenticated) {
        throw new Error(
          'Login did not persist your session cookie. Use the same host for frontend and backend (127.0.0.1 or localhost), then try again.'
        )
      }

      navigate('/')
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error.')
    } finally {
      clearTimer()
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714] text-center">Hanlearn</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f] text-center">
          Login to your account.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-[#4e4138]">
            Username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
            />
          </label>

          <label className="block text-sm font-semibold text-[#4e4138]">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
            />
          </label>

          {errorMessage ? <p className="text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {isSubmitting ? 'Please wait…' : 'Log in'}
          </button>
          {isSubmitting && isSubmittingTimedOut && (
            <RetryPrompt
              onRetry={() => void handleSubmit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)}
              onCancel={() => {
                submittingControllerRef.current?.abort()
                setIsSubmitting(false)
              }}
            />
          )}
        </form>

        <p className="mt-5 text-center text-sm text-[#66594f]">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-[#d1451b] hover:underline">
            Create one
          </Link>
        </p>
      </section>
    </main>
  )
}
