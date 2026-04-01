import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function ProfileSettingsPage() {
  const navigate = useNavigate()
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [username, setUsername] = useState<string | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [usernamePassword, setUsernamePassword] = useState('')
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false)
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
        })

        const payload = (await response.json()) as {
          is_authenticated?: unknown
          username?: unknown
        }

        if (!response.ok || payload.is_authenticated !== true || typeof payload.username !== 'string') {
          navigate('/login', { replace: true })
          return
        }

        setUsername(payload.username)
        setNewUsername(payload.username)
      } catch {
        navigate('/login', { replace: true })
      } finally {
        setIsLoadingAuth(false)
      }
    }

    void loadAuth()
  }, [navigate])

  const handleUpdateUsername = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = newUsername.trim()
    if (!trimmedUsername || !usernamePassword) {
      setUsernameError('Enter a new username and your current password.')
      setUsernameSuccess(null)
      return
    }

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
      const message = error instanceof Error ? error.message : 'Unexpected error while updating username.'
      setUsernameError(message)
    } finally {
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
      const message = error instanceof Error ? error.message : 'Unexpected error while updating password.'
      setPasswordError(message)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (isLoadingAuth) {
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
              disabled={isUpdatingUsername}
              className="w-full rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUpdatingUsername ? 'Updating...' : 'Update Username'}
            </button>
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
              disabled={isUpdatingPassword}
              className="w-full rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
