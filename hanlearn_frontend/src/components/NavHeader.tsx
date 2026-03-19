import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const navItemBase = 'rounded-full px-4 py-2 text-sm font-semibold transition'

export function NavHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!response.ok) {
          setIsAuthenticated(false)
          return
        }

        const payload = (await response.json()) as { is_authenticated?: unknown }
        setIsAuthenticated(payload.is_authenticated === true)
      } catch {
        setIsAuthenticated(false)
      }
    }

    void loadAuth()
  }, [location.pathname])

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isProfileMenuOpen])

  useEffect(() => {
    setIsProfileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setIsAuthenticated(false)
      setIsProfileMenuOpen(false)
      navigate('/login')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#d6c7b6]/90 bg-[#f7f2ea]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#d1451b] text-lg font-extrabold text-white shadow-md">
            汉
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f7f6f]">Hanlearn</p>
            <p className="text-sm text-[#5b4f46]">Mandarin Vocabulary Miner</p>
          </div>
        </NavLink>

        <nav className="flex flex-wrap items-center gap-2">
          {isAuthenticated ? (
            <>
              <NavLink
                to="/analyze"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? 'bg-[#d1451b] text-white' : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'}`
                }
              >
                Miner
              </NavLink>
              <NavLink
                to="/paste"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? 'bg-[#d1451b] text-white' : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'}`
                }
              >
                Library
              </NavLink>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  className={`grid h-8 w-8 place-items-center rounded-full border transition ${
                    isProfileMenuOpen || location.pathname === '/account'
                      ? 'border-[#d1451b] bg-[#d1451b] text-white'
                      : 'border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'
                  }`}
                >
                  <span className="sr-only">Profile</span>
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current" />
                </button>

                {isProfileMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Profile menu"
                    className="absolute right-0 top-10 z-40 min-w-40 rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-1.5 shadow-xl shadow-[#bf9f83]/25"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsProfileMenuOpen(false)
                        navigate('/account')
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#3f342b] transition hover:bg-[#f4e4d6]"
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#9d2f1a] transition hover:bg-[#fde8e2]"
                    >
                      Log Out
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? 'bg-[#d1451b] text-white' : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'}`
                }
              >
                Log in
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? 'bg-[#d1451b] text-white' : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'}`
                }
              >
                Sign up
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}