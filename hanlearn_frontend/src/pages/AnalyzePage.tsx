import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type RankedWord = {
  word: string
  pinyin: string
  occurrences: number
  percentage: number
  is_known: boolean
}

type AnalysisPayload = {
  cleaned_text: string
  known_percentage: number
  total_occurrences: number
  words: RankedWord[]
  unknown_words: string[]
}

type AnalyzeLocationState = {
  analysis?: AnalysisPayload
  sourceText?: string
}

export function AnalyzePage() {
  const location = useLocation()
  const state = (location.state as AnalyzeLocationState | null) ?? null
  const analysis = state?.analysis
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [flashcardMessage, setFlashcardMessage] = useState<string | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const flashcardWords = useMemo(
    () => (analysis?.words ?? []).filter((row) => !row.is_known).map((row) => ({ word: row.word, pinyin: row.pinyin })),
    [analysis],
  )

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

  if (!analysis) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
        <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
          <h1 className="text-3xl font-extrabold text-[#1b1714]">Vocabulary Coverage Report</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#66594f]">
            No analysis is loaded yet. Paste text or load a file first so Hanlearn can generate your report.
          </p>
          <div className="mt-6">
            <Link
              to="/paste"
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Open Analyzer Input
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const unknownCount = analysis.unknown_words.length
  const suggestedHsk =
    analysis.known_percentage >= 95
      ? 'HSK 6'
      : analysis.known_percentage >= 85
        ? 'HSK 5'
        : analysis.known_percentage >= 70
          ? 'HSK 4'
          : analysis.known_percentage >= 55
            ? 'HSK 3'
            : 'HSK 2'
  const topUnknownWords = analysis.words.filter((row) => !row.is_known).slice(0, 12)
  const handleConvertToFlashcards = async () => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true)
      return
    }

    setIsConverting(true)
    setFlashcardMessage(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/flashcards/create`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words: flashcardWords }),
      })

      const payload = (await response.json()) as { error?: unknown; total?: unknown }
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to create flashcards.'
        throw new Error(error)
      }

      const total = typeof payload.total === 'number' ? payload.total : null
      setFlashcardMessage(
        total !== null ? `Flashcards saved successfully. Your deck now has ${total} cards.` : 'Flashcards saved successfully.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while creating flashcards.'
      setFlashcardMessage(message)
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
        <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
          <h1 className="text-3xl font-extrabold text-[#1b1714]">Vocabulary Coverage Report</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
            Based on your pasted passage, these are the words you likely still need to learn.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Coverage</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{analysis.known_percentage.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Unknown words</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{unknownCount}</p>
            </div>
            <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Suggested HSK target</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{suggestedHsk}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
            <h2 className="text-lg font-bold text-[#1b1714]">Priority drill set</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
              {topUnknownWords.map((row) => (
                <span
                  key={`${row.word}-${row.occurrences}`}
                  className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]"
                  title={`${row.pinyin} | ${row.occurrences} occurrences`}
                >
                  {row.word}
                </span>
              ))}
              {!topUnknownWords.length ? (
                <span className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]">
                  Great job, no unknown words found
                </span>
              ) : null}
            </div>

            <div className="mt-5 border-t border-[#efe3d4] pt-4">
              <button
                type="button"
                onClick={handleConvertToFlashcards}
                disabled={isConverting || !flashcardWords.length}
                className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isConverting ? 'Converting...' : 'Convert to Flashcards'}
              </button>
              {flashcardMessage ? <p className="mt-3 text-sm font-semibold text-[#8c2f11]">{flashcardMessage}</p> : null}
            </div>
          </div>

          {state?.sourceText ? (
            <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
              <h2 className="text-lg font-bold text-[#1b1714]">Analyzed passage</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#4b3f36]">{state.sourceText}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/paste"
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Analyze New Text or File
            </Link>
          </div>
        </section>
      </main>

      {isAuthModalOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-[#1b1714]">Account Required</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
              Saving flashcards is available to registered users. Create an account or sign in to continue.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link
                to="/account?mode=register"
                className="rounded-xl bg-[#d1451b] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#b63e19]"
              >
                Sign up
              </Link>
              <Link
                to="/account?mode=login"
                className="rounded-xl border border-[#1b1714] bg-white px-4 py-3 text-center text-sm font-semibold transition hover:bg-[#faf6f0]"
              >
                Log in
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="mt-4 w-full rounded-xl border border-[#d8ccbd] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#5b4f46] transition hover:bg-[#fff0df]"
            >
              Continue as guest
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
