import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setErrorMessage('Enter both username and password.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
      })

      const payload = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Login failed.'
        throw new Error(error)
      }

      navigate('/')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Log In</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Log in to access your vocabulary bank and text library.
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
            className="w-full rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Please wait…' : 'Sign In'}
          </button>
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
