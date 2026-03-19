import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AnalyzePage } from './pages/AnalyzePage'
import { AccountPage } from './pages/AccountPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { PastePage } from './pages/PastePage'
import { SignupPage } from './pages/SignupPage'
import { NavHeader } from './components/NavHeader'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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
  return (
    <>
      <NavHeader />
      <Routes>
        <Route path="/" element={<RootEntryPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/upload" element={<Navigate to="/paste" replace />} />
        <Route path="/paste" element={<PastePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
