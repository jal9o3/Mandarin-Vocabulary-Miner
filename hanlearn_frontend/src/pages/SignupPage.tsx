import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { BusyRetryBanner } from '../components/LoadingWithRetry'
import { attachTimeout, isAbortError, isBackendConnectionFailure } from '../lib/requestUtils'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

export function SignupPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingTimedOut, setIsSubmittingTimedOut] = useState(false)
  const [isSubmittingTimeoutExhausted, setIsSubmittingTimeoutExhausted] = useState(false)
  const submittingControllerRef = useRef<AbortController | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()
    if (!trimmedUsername || !trimmedEmail || !password) {
      setErrorMessage('All fields are required.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmittingTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsSubmittingTimedOut, submittingControllerRef)
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, email: trimmedEmail, password }),
        signal: submittingControllerRef.current?.signal,
      })

      const payload = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Registration failed.'
        throw new Error(error)
      }

      navigate('/')
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsSubmittingTimedOut(true)
        return
      }
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error.')
    } finally {
      clearTimer()
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Create Account</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Join Hanlearn to save your vocabulary bank and track your progress.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-[#4e4138]">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
            />
          </label>

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
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 pr-10 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7a6a] hover:text-[#4e4138]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </label>

          <label className="block text-sm font-semibold text-[#4e4138]">
            Confirm Password
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 pr-10 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7a6a] hover:text-[#4e4138]"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>
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
            {isSubmitting ? 'Processing…' : 'Create Account'}
          </button>
          <BusyRetryBanner
            active={isSubmittingTimedOut}
            onExhausted={() => setIsSubmittingTimeoutExhausted(true)}
          />
        </form>

        <p className="mt-5 text-center text-sm text-[#66594f]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#d1451b] hover:underline">
            Log in
          </Link>
        </p>
      </section>
    </main>
  )
}
