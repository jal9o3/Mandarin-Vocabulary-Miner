import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { NavHeader } from './components/NavHeader'

const THEME_STORAGE_KEY = 'hanlearn-theme'

type Theme = 'light' | 'dark'

const AnalyzePage = lazy(() => import('./pages/AnalyzePage').then((module) => ({ default: module.AnalyzePage })))
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const PastePage = lazy(() => import('./pages/PastePage').then((module) => ({ default: module.PastePage })))
const SignupPage = lazy(() => import('./pages/SignupPage').then((module) => ({ default: module.SignupPage })))
const FlashcardReviewPage = lazy(() => import('./pages/FlashcardReviewPage').then((module) => ({ default: module.FlashcardReviewPage })))
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage').then((module) => ({ default: module.ProfileSettingsPage })))

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
  return <LandingPage />
}

function RouteLoadingState() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-10 sm:px-10">
      <div className="rounded-full border border-[#d8cab8] bg-[var(--han-panel)] px-5 py-3 text-sm font-semibold text-[#66594f] shadow-sm">
        Processing page…
      </div>
    </main>
  )
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
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route path="/" element={<RootEntryPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/upload" element={<Navigate to="/paste" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/paste" element={<PastePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<ProfileSettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/review" element={<FlashcardReviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
