import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

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
  saved_flashcard_words?: string[]
  priority_drill_set?: Array<{
    word: string
    info: {
      pronunciation?: string
      meanings?: string[]
    } | null
  }>
}

type AnalyzeLocationState = {
  analysis?: AnalysisPayload
  sourceText?: string
  selectionState?: {
    text: string
    screening: {
      cleaned_text: string
      total_unique_words: number
      total_occurrences: number
      groups: Array<{
        level: string
        words: Array<{
          word: string
          pinyin: string
          occurrences: number
        }>
      }>
    } | null
    selectedWords: string[]
  }
}

export function AnalyzePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as AnalyzeLocationState | null) ?? null
  const analysis = state?.analysis
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [flashcardMessage, setFlashcardMessage] = useState<string | null>(null)
  const [flashcardToast, setFlashcardToast] = useState<string | null>(null)
  const [hasSavedFlashcards, setHasSavedFlashcards] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const priorityDrillSet = useMemo(
    () => {
      if (analysis?.priority_drill_set) {
        return analysis.priority_drill_set
      }

      const savedWords = new Set(analysis?.saved_flashcard_words ?? [])
      return (
        analysis?.words
          .filter((row) => !row.is_known)
          .filter((row) => !savedWords.has(row.word))
          .slice(0, 12)
          .map((row) => ({
            word: row.word,
            info: null,
          })) ??
        []
      )
    },
    [analysis],
  )
  const flashcardWords = useMemo(
    () => {
      const infoByWord = new Map(
        priorityDrillSet.map((item) => [item.word, item.info] as const),
      )

      return (analysis?.words ?? []).filter((row) => !row.is_known).map((row) => {
        const info = infoByWord.get(row.word)
        const meanings = Array.isArray(info?.meanings)
          ? info.meanings.map((meaning) => meaning.trim()).filter((meaning) => meaning.length > 0)
          : []
        const pronunciation = typeof info?.pronunciation === 'string' && info.pronunciation.trim().length > 0
          ? info.pronunciation.trim()
          : row.pinyin

        return meanings.length > 0
          ? { word: row.word, pinyin: pronunciation, meanings }
          : { word: row.word, pinyin: pronunciation }
      })
    },
    [analysis, priorityDrillSet],
  )
  const unknownWordSet = useMemo(() => new Set((analysis?.unknown_words ?? []).filter((word) => word.length > 0)), [analysis])
  const savedFlashcardWordSet = useMemo(
    () => new Set((analysis?.saved_flashcard_words ?? []).filter((word) => word.length > 0)),
    [analysis],
  )
  const highlightedPassageParts = useMemo(() => {
    const sourceText = state?.sourceText ?? ''
    if (!sourceText.length) {
      return [sourceText]
    }

    const uniqueHighlightedWords = [...new Set([...unknownWordSet, ...savedFlashcardWordSet])]
    if (!uniqueHighlightedWords.length) {
      return [sourceText]
    }

    const escapedWords = uniqueHighlightedWords
      .sort((a, b) => b.length - a.length)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const matcher = new RegExp(`(${escapedWords.join('|')})`, 'g')
    return sourceText.split(matcher).filter((part) => part.length > 0)
  }, [savedFlashcardWordSet, state?.sourceText, unknownWordSet])

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

  useEffect(() => {
    if (!flashcardToast) {
      return
    }

    const timeoutId = window.setTimeout(() => setFlashcardToast(null), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [flashcardToast])

  useEffect(() => {
    setHasSavedFlashcards(false)
  }, [analysis?.cleaned_text])

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
  const handleBackToSelection = () => {
    if (!state?.selectionState?.screening) {
      navigate('/paste')
      return
    }

    navigate('/paste', {
      state: {
        returnToSelection: {
          text: state.selectionState.text,
          screening: state.selectionState.screening,
          selectedWords: state.selectionState.selectedWords,
        },
      },
    })
  }

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

      const payload = (await response.json()) as { error?: unknown; total?: unknown; created?: unknown }
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to create flashcards.'
        throw new Error(error)
      }

      const created = typeof payload.created === 'number' ? payload.created : 0
      setHasSavedFlashcards(true)
      setFlashcardToast(`${created} flashcards saved.`)
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
          <button
            type="button"
            onClick={handleBackToSelection}
            className="rounded-xl border border-[#1b1714] bg-white/80 px-4 py-2 text-sm font-semibold transition hover:bg-white"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-extrabold text-[#1b1714] text-center">Text Analysis</h1>
          {/* <p className="mt-2 text-sm leading-relaxed text-[#66594f] text-center">
            Based on your pasted passage, these are the words you likely still need to learn.
          </p> */}

          {state?.sourceText ? (
            <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
              {/* <h2 className="text-lg font-bold text-[#1b1714]">Analyzed passage</h2> */}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#4b3f36]">
                {highlightedPassageParts.map((part, index) =>
                  savedFlashcardWordSet.has(part) ? (
                    <span key={`${part}-${index}`} className="text-[#c18a00]">
                      {part}
                    </span>
                  ) : unknownWordSet.has(part) ? (
                    <span key={`${part}-${index}`} className="text-[#b42020]">
                      {part}
                    </span>
                  ) : (
                    <span key={`${part}-${index}`}>{part}</span>
                  ),
                )}
              </p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Readability Estimate</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{analysis.known_percentage.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Unknown words</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{unknownCount}</p>
            </div>
            {/* <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Suggested HSK target</p>
              <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{suggestedHsk}</p>
            </div> */}
          </div>

          <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
            <h2 className="text-lg font-bold text-[#1b1714]">Priority drill set</h2>
            <div className="mt-3 grid gap-3">
              {priorityDrillSet.map((item, index) => (
                <article key={`${item.word}-${index}`} className="rounded-lg border border-[#f0e3d5] bg-[#fffbf4] p-3">
                  <p className="text-sm font-bold text-[#8c2f11]">{item.word}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#8d7c6f]">Pronunciation</p>
                  <p className="mt-1 text-sm text-[#4b3f36]">{item.info?.pronunciation ?? 'N/A'}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#8d7c6f]">Meanings</p>
                  <p className="mt-1 text-sm text-[#4b3f36]">
                    {(item.info?.meanings ?? []).length ? item.info?.meanings?.join('; ') : 'N/A'}
                  </p>
                </article>
              ))}
              {!priorityDrillSet.length ? (
                <p className="rounded-lg bg-[var(--han-accent-soft)] px-3 py-2 text-sm font-semibold text-[#8c2f11]">
                  Great job, no unknown words found
                </p>
              ) : null}
            </div>

            <div className="mt-5 border-t border-[#efe3d4] pt-4">
              <button
                type="button"
                onClick={hasSavedFlashcards ? () => navigate('/review') : handleConvertToFlashcards}
                disabled={isConverting || (!flashcardWords.length && !hasSavedFlashcards)}
                className="ml-auto block rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isConverting ? 'Creating...' : hasSavedFlashcards ? 'Review Flashcards' : 'Create Flashcards'}
              </button>
              {flashcardMessage ? <p className="mt-3 text-sm font-semibold text-[#b42020]">{flashcardMessage}</p> : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {/* <Link
              to="/paste"
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Analyze New Text or File
            </Link> */}
          </div>
        </section>
      </main>

      {isAuthModalOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close modal"
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-sm font-bold text-[#5b4f46] transition hover:bg-[#faf6f0]"
            >
              x
            </button>
            <h2 className="text-2xl font-extrabold text-[#1b1714]">Account Required</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
              You need an account to save your flashcards.
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

            {/* <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="mt-4 w-full rounded-xl border border-[#d8ccbd] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#5b4f46] transition hover:bg-[#fff0df]"
            >
              Continue as guest
            </button> */}
          </div>
        </div>
      ) : null}

      {flashcardToast ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-[#1b1714] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {flashcardToast}
        </div>
      ) : null}
    </>
  )
}
