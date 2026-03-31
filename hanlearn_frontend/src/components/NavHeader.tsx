import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const navItemBase = 'rounded-full px-4 py-2 text-sm font-semibold transition'

type NavHeaderProps = {
  isDarkMode: boolean
  onToggleDarkMode: () => void
}

export function NavHeader({ isDarkMode, onToggleDarkMode }: NavHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const headerClasses = isDarkMode
    ? 'sticky top-0 z-30 border-b border-[#3a3028]/90 bg-[#1a1613]/88 backdrop-blur'
    : 'sticky top-0 z-30 border-b border-[#d6c7b6]/90 bg-[#f7f2ea]/85 backdrop-blur'
  const brandMonogramClasses = isDarkMode
    ? 'grid h-10 w-10 place-items-center rounded-lg bg-[#f06d42] text-lg font-extrabold text-white shadow-md'
    : 'grid h-10 w-10 place-items-center rounded-lg bg-[#d1451b] text-lg font-extrabold text-white shadow-md'
  const brandTaglineClasses = isDarkMode
    ? 'text-xs font-semibold uppercase tracking-[0.24em] text-[#baaa9a]'
    : 'text-xs font-semibold uppercase tracking-[0.24em] text-[#8f7f6f]'
  const brandSubtitleClasses = isDarkMode ? 'text-sm text-[#f0e2d5]' : 'text-sm text-[#5b4f46]'
  const navItemInactiveClasses = isDarkMode
    ? 'border border-[#d8c4b2] text-[#f2e6db] hover:bg-[#d8c4b2] hover:text-[#1a1613]'
    : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'
  const navItemActiveClasses = isDarkMode ? 'bg-[#f06d42] text-[#1a1613]' : 'bg-[#d1451b] text-white'
  const profileButtonActiveClasses = isDarkMode
    ? 'border-[#f06d42] bg-[#f06d42] text-[#1a1613]'
    : 'border-[#d1451b] bg-[#d1451b] text-white'
  const profileButtonInactiveClasses = isDarkMode
    ? 'border-[#d8c4b2] text-[#f2e6db] hover:bg-[#d8c4b2] hover:text-[#1a1613]'
    : 'border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'
  const profileMenuClasses = isDarkMode
    ? 'absolute right-0 top-10 z-40 min-w-40 rounded-xl border border-[#4b3f35] bg-[#221c18] p-1.5 shadow-xl shadow-black/35'
    : 'absolute right-0 top-10 z-40 min-w-40 rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-1.5 shadow-xl shadow-[#bf9f83]/25'
  const profileSettingsClasses = isDarkMode
    ? 'block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#f2e6db] transition hover:bg-[#3a3028]'
    : 'block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#3f342b] transition hover:bg-[#f4e4d6]'
  const profileLogoutClasses = isDarkMode
    ? 'block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#ffb39b] transition hover:bg-[#47221b]'
    : 'block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#9d2f1a] transition hover:bg-[#fde8e2]'
  const themeToggleClasses = isDarkMode
    ? 'grid h-10 w-10 place-items-center rounded-full border border-[#d8c4b2] bg-[#2a221d] text-[#f6eee7] transition hover:bg-[#d8c4b2] hover:text-[#1a1613]'
    : 'grid h-10 w-10 place-items-center rounded-full border border-[#1b1714] bg-transparent text-[#1b1714] transition hover:bg-[#1b1714] hover:text-white'

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
    <header className={headerClasses}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
        <NavLink to="/" className="flex items-center gap-3">
          <div className={brandMonogramClasses}>
            汉
          </div>
          <div>
            <p className={brandTaglineClasses}>Hanlearn</p>
            <p className={brandSubtitleClasses}>Mandarin Vocabulary Miner</p>
          </div>
        </NavLink>

        <nav className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className={themeToggleClasses}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAuthenticated ? (
            <>
              <NavLink
                to="/paste"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? navItemActiveClasses : navItemInactiveClasses}`
                }
              >
                Miner
              </NavLink>
              <NavLink
                to="/library"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? navItemActiveClasses : navItemInactiveClasses}`
                }
              >
                Library
              </NavLink>
              <NavLink
                to="/review"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? navItemActiveClasses : navItemInactiveClasses}`
                }
              >
                Flashcards
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
                      ? profileButtonActiveClasses
                      : profileButtonInactiveClasses
                  }`}
                >
                  <span className="sr-only">Profile</span>
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current" />
                </button>

                {isProfileMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Profile menu"
                    className={profileMenuClasses}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsProfileMenuOpen(false)
                        navigate('/account')
                      }}
                      className={profileSettingsClasses}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className={profileLogoutClasses}
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
                  `${navItemBase} ${isActive ? navItemActiveClasses : navItemInactiveClasses}`
                }
              >
                Login
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? navItemActiveClasses : navItemInactiveClasses}`
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