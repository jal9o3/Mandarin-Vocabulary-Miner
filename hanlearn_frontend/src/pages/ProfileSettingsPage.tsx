import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { useAuth } from '../lib/auth'
import { BusyRetryBanner } from '../components/LoadingWithRetry'
import { attachTimeout, isAbortError, isBackendConnectionFailure } from '../lib/requestUtils'

export function ProfileSettingsPage() {
  const navigate = useNavigate()
  const { status, username, setUsername } = useAuth()

  const [newUsername, setNewUsername] = useState('')
  const [usernamePassword, setUsernamePassword] = useState('')
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false)
  const [isUpdatingUsernameTimedOut, setIsUpdatingUsernameTimedOut] = useState(false)
  const [isUpdatingUsernameTimeoutExhausted, setIsUpdatingUsernameTimeoutExhausted] = useState(false)
  const updatingUsernameControllerRef = useRef<AbortController | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isUpdatingPasswordTimedOut, setIsUpdatingPasswordTimedOut] = useState(false)
  const [isUpdatingPasswordTimeoutExhausted, setIsUpdatingPasswordTimeoutExhausted] = useState(false)
  const updatingPasswordControllerRef = useRef<AbortController | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (status !== 'authenticated') {
      navigate('/login', { replace: true })
    }
  }, [navigate, status])

  useEffect(() => {
    if (username) {
      setNewUsername(username)
    }
  }, [username])

  const handleUpdateUsername = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = newUsername.trim()
    if (!trimmedUsername || !usernamePassword) {
      setUsernameError('Enter a new username and your current password.')
      setUsernameSuccess(null)
      return
    }

    setIsUpdatingUsernameTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsUpdatingUsernameTimedOut, updatingUsernameControllerRef)
    setIsUpdatingUsername(true)
    setUsernameError(null)
    setUsernameSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/username`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_username: trimmedUsername,
          current_password: usernamePassword,
        }),
        signal: updatingUsernameControllerRef.current?.signal,
      })

      const payload = (await response.json()) as {
        error?: unknown
        username?: unknown
      }

      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to update username.'
        throw new Error(error)
      }

      if (typeof payload.username === 'string') {
        setUsername(payload.username)
        setNewUsername(payload.username)
      }

      setUsernamePassword('')
      setUsernameSuccess('Username updated successfully.')
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsUpdatingUsernameTimedOut(true)
        return
      }
      const message = error instanceof Error ? error.message : 'Unexpected error while updating username.'
      setUsernameError(message)
    } finally {
      clearTimer()
      setIsUpdatingUsername(false)
    }
  }

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentPassword || !newPassword) {
      setPasswordError('Enter your current password and a new password.')
      setPasswordSuccess(null)
      return
    }

    setIsUpdatingPasswordTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsUpdatingPasswordTimedOut, updatingPasswordControllerRef)
    setIsUpdatingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
        signal: updatingPasswordControllerRef.current?.signal,
      })

      const payload = (await response.json()) as { error?: unknown }
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to update password.'
        throw new Error(error)
      }

      setCurrentPassword('')
      setNewPassword('')
      setPasswordSuccess('Password updated successfully.')
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsUpdatingPasswordTimedOut(true)
        return
      }
      const message = error instanceof Error ? error.message : 'Unexpected error while updating password.'
      setPasswordError(message)
    } finally {
      clearTimer()
      setIsUpdatingPassword(false)
    }
  }

  if (status === 'loading') {
    return <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10" />
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Profile Settings</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Signed in as <span className="font-semibold text-[#2d241d]">{username ?? 'Unknown user'}</span>.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <form className="space-y-3 rounded-xl border border-[#e6dbc9] bg-white p-4" onSubmit={handleUpdateUsername}>
            <h2 className="text-lg font-bold text-[#2d241d]">Change Username</h2>

            <label className="block text-sm font-semibold text-[#4e4138]">
              New username
              <input
                type="text"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
              />
            </label>

            <label className="block text-sm font-semibold text-[#4e4138]">
              Current password
              <input
                type="password"
                value={usernamePassword}
                onChange={(event) => setUsernamePassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
              />
            </label>

            {usernameError ? <p className="text-sm font-semibold text-[#b42020]">{usernameError}</p> : null}
            {usernameSuccess ? <p className="text-sm font-semibold text-[#0d7a3d]">{usernameSuccess}</p> : null}

            <button
              type="submit"
              disabled={isUpdatingUsername || (isUpdatingUsernameTimedOut && !isUpdatingUsernameTimeoutExhausted)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUpdatingUsername && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isUpdatingUsername ? 'Updating...' : 'Update Username'}
            </button>
            <BusyRetryBanner
              active={isUpdatingUsernameTimedOut}
              onExhausted={() => setIsUpdatingUsernameTimeoutExhausted(true)}
            />
          </form>

          <form className="space-y-3 rounded-xl border border-[#e6dbc9] bg-white p-4" onSubmit={handleUpdatePassword}>
            <h2 className="text-lg font-bold text-[#2d241d]">Change Password</h2>

            <label className="block text-sm font-semibold text-[#4e4138]">
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
              />
            </label>

            <label className="block text-sm font-semibold text-[#4e4138]">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-3 text-sm text-[#2d241d] outline-none ring-[#d1451b] focus:ring-2"
              />
            </label>

            {passwordError ? <p className="text-sm font-semibold text-[#b42020]">{passwordError}</p> : null}
            {passwordSuccess ? <p className="text-sm font-semibold text-[#0d7a3d]">{passwordSuccess}</p> : null}

            <button
              type="submit"
              disabled={isUpdatingPassword || (isUpdatingPasswordTimedOut && !isUpdatingPasswordTimeoutExhausted)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUpdatingPassword && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
            <BusyRetryBanner
              active={isUpdatingPasswordTimedOut}
              onExhausted={() => setIsUpdatingPasswordTimeoutExhausted(true)}
            />
          </form>
        </div>
      </section>
    </main>
  )
}
