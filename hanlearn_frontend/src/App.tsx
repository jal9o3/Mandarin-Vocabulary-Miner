import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AnalyzePage } from './pages/AnalyzePage'
import { AccountPage } from './pages/AccountPage'
import { LandingPage } from './pages/LandingPage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { PastePage } from './pages/PastePage'
import { SignupPage } from './pages/SignupPage'
import { FlashcardReviewPage } from './pages/FlashcardReviewPage'
import { NavHeader } from './components/NavHeader'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const THEME_STORAGE_KEY = 'hanlearn-theme'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function RootEntryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

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
  }, [])

  if (isAuthenticated === null) {
    return <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10" />
  }

  return isAuthenticated ? <PastePage /> : <LandingPage />
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return (
    <>
      <NavHeader
        isDarkMode={theme === 'dark'}
        onToggleDarkMode={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
      <Routes>
        <Route path="/" element={<RootEntryPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/upload" element={<Navigate to="/paste" replace />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/paste" element={<PastePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/review" element={<FlashcardReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
