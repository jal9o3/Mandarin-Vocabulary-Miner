import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { useAuth } from '../lib/auth'

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

type DrillItem = {
  word: string
  info: {
    pronunciation?: string
    meanings?: string[]
  } | null
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21H3v-4z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export function AnalyzePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const state = (location.state as AnalyzeLocationState | null) ?? null
  const analysis = state?.analysis
  const [isConverting, setIsConverting] = useState(false)
  const [flashcardMessage, setFlashcardMessage] = useState<string | null>(null)
  const [flashcardToast, setFlashcardToast] = useState<string | null>(null)
  const [hasSavedFlashcards, setHasSavedFlashcards] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isSavedToLibrary, setIsSavedToLibrary] = useState(false)
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false)
  const [existingFlashcardWords, setExistingFlashcardWords] = useState<string[]>([])
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [excludedDrillIndices, setExcludedDrillIndices] = useState<Set<number>>(new Set())
  const [editingDrillIndex, setEditingDrillIndex] = useState<number | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editWord, setEditWord] = useState('')
  const [editPronunciation, setEditPronunciation] = useState('')
  const [editMeanings, setEditMeanings] = useState('')
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null)
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
      return drillItems
        .filter((_item, index) => !excludedDrillIndices.has(index))
        .map((item) => {
        const info = item.info
        const meanings = Array.isArray(info?.meanings)
          ? info.meanings.map((meaning) => meaning.trim()).filter((meaning) => meaning.length > 0)
          : []
        const pronunciation = typeof info?.pronunciation === 'string' && info.pronunciation.trim().length > 0
          ? info.pronunciation.trim()
          : ''

        return meanings.length > 0
          ? { word: item.word, pinyin: pronunciation, meanings }
          : { word: item.word, pinyin: pronunciation }
      })
    },
    [drillItems, excludedDrillIndices],
  )
  const unknownWordSet = useMemo(() => new Set((analysis?.unknown_words ?? []).filter((word) => word.length > 0)), [analysis])
  const savedFlashcardWordSet = useMemo(
    () => new Set([...(analysis?.saved_flashcard_words ?? []).filter((word) => word.length > 0), ...existingFlashcardWords]),
    [analysis, existingFlashcardWords],
  )
  const filteredPriorityDrillSet = useMemo(
    () => priorityDrillSet.filter((item) => !savedFlashcardWordSet.has(item.word)),
    [priorityDrillSet, savedFlashcardWordSet],
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
    if (!isAuthenticated) {
      setExistingFlashcardWords([])
      return
    }

    const loadExistingFlashcards = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/flashcards`, {
          method: 'GET',
          credentials: 'include',
        })

        if (!response.ok) {
          setExistingFlashcardWords([])
          return
        }

        const payload = (await response.json()) as { flashcards?: Array<{ word?: unknown }> }
        const words = (payload.flashcards ?? [])
          .map((flashcard) => (typeof flashcard.word === 'string' ? flashcard.word.trim() : ''))
          .filter((word) => word.length > 0)

        setExistingFlashcardWords(words)
      } catch {
        setExistingFlashcardWords([])
      }
    }

    void loadExistingFlashcards()
  }, [isAuthenticated])

  useEffect(() => {
    if (!flashcardToast) {
      return
    }

    const timeoutId = window.setTimeout(() => setFlashcardToast(null), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [flashcardToast])

  useEffect(() => {
    setHasSavedFlashcards(false)
    setIsSavedToLibrary(false)
  }, [analysis?.cleaned_text])

  useEffect(() => {
    if (!analysis) {
      return
    }

    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [analysis])

  useEffect(() => {
    setDrillItems(
      filteredPriorityDrillSet.map((item) => ({
        word: item.word,
        info: item.info
          ? {
            pronunciation: item.info.pronunciation,
            meanings: item.info.meanings ? [...item.info.meanings] : undefined,
          }
          : null,
      })),
    )
    setExcludedDrillIndices(new Set())
    setEditingDrillIndex(null)
    setIsEditModalOpen(false)
    setEditErrorMessage(null)
  }, [filteredPriorityDrillSet])

  const handleToggleExcludeDrillItem = (index: number) => {
    setExcludedDrillIndices((previous) => {
      const next = new Set(previous)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
    setHasSavedFlashcards(false)
  }

  const handleOpenEditModal = (index: number) => {
    const item = drillItems[index]
    if (!item) {
      return
    }

    setEditingDrillIndex(index)
    setEditWord(item.word)
    setEditPronunciation(item.info?.pronunciation ?? '')
    setEditMeanings((item.info?.meanings ?? []).join('; '))
    setEditErrorMessage(null)
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setEditingDrillIndex(null)
    setEditErrorMessage(null)
  }

  const handleSaveEditedDrillItem = () => {
    if (editingDrillIndex === null) {
      return
    }

    const nextWord = editWord.trim()
    if (!nextWord) {
      setEditErrorMessage('Word cannot be empty.')
      return
    }

    const nextPronunciation = editPronunciation.trim()
    const nextMeanings = editMeanings
      .split(';')
      .map((meaning) => meaning.trim())
      .filter((meaning) => meaning.length > 0)
      .filter((meaning, index, values) => values.indexOf(meaning) === index)

    const nextInfo = nextPronunciation.length || nextMeanings.length
      ? {
        pronunciation: nextPronunciation.length ? nextPronunciation : undefined,
        meanings: nextMeanings.length ? nextMeanings : undefined,
      }
      : null

    setDrillItems((previous) => previous.map((item, index) => (
      index === editingDrillIndex
        ? {
          word: nextWord,
          info: nextInfo,
        }
        : item
    )))
    setHasSavedFlashcards(false)
    handleCloseEditModal()
  }

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

  const handleSaveToLibrary = async () => {
    const sourceText = state?.sourceText ?? ''
    if (!sourceText.trim()) {
      return
    }

    if (!isAuthenticated) {
      setIsAuthModalOpen(true)
      return
    }

    setIsSavingToLibrary(true)
    try {
      const title = sourceText.trim().slice(0, 50)
      const response = await fetch(`${API_BASE_URL}/api/library/save`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sourceText.trim(), title }),
      })
      if (response.ok || response.status === 201) {
        setIsSavedToLibrary(true)
        setFlashcardToast('Text saved to library.')
      }
    } finally {
      setIsSavingToLibrary(false)
    }
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
            <div className="relative mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
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
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveToLibrary}
                  disabled={isSavingToLibrary}
                  aria-label={isSavedToLibrary ? 'Saved to library' : 'Save to library'}
                  title={isSavedToLibrary ? 'Saved to library' : 'Save to library'}
                  className={`inline-flex items-center justify-center rounded-full p-2 transition ${
                    isSavedToLibrary
                      ? 'text-[#d1451b]'
                      : 'text-[#c0c0c0] hover:text-[#d1451b]'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <HeartIcon filled={isSavedToLibrary} />
                </button>
              </div>
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
            <h2 className="text-lg font-bold text-[#1b1714]">New Extracted Words</h2>
            <div className="mt-3 grid gap-3">
              {drillItems.map((item, index) => {
                const isExcluded = excludedDrillIndices.has(index)

                return (
                <article
                  key={`${item.word}-${index}`}
                  className={`rounded-lg border p-3 ${isExcluded ? 'border-[#e8d8cb] bg-[#faf4ec] opacity-70' : 'border-[#f0e3d5] bg-[#fffbf4]'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#8c2f11]">{item.word}</p>
                    <div className="flex items-center gap-2">
                      {isExcluded ? (
                        <span className="rounded-full bg-[#efe1d1] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7c685a]">
                          Excluded
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(index)}
                        className="inline-flex items-center justify-center rounded-md border border-[#d6c7b6] bg-[#fff8ef] p-2 text-[#5e5349] transition hover:border-[#bfa286] hover:bg-[#fff1df] hover:text-[#1b1714]"
                        aria-label={`Edit ${item.word}`}
                        title="Edit word"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleExcludeDrillItem(index)}
                        className={`inline-flex items-center justify-center rounded-md border p-2 transition ${isExcluded ? 'border-[#d6c7b6] bg-[#fff8ef] text-[#5e5349] hover:border-[#bfa286] hover:bg-[#fff1df] hover:text-[#1b1714]' : 'border-[#e9b5b5] bg-[#fff0f0] text-[#c0392b] hover:border-[#dc8f8f] hover:bg-[#ffe3e3] hover:text-[#a12f24]'}`}
                        aria-label={`${isExcluded ? 'Include' : 'Exclude'} ${item.word}`}
                        title={isExcluded ? 'Include word' : 'Exclude word'}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#8d7c6f]">Pronunciation</p>
                  <p className="mt-1 text-sm text-[#4b3f36]">{item.info?.pronunciation ?? 'N/A'}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#8d7c6f]">Meanings</p>
                  <p className="mt-1 text-sm text-[#4b3f36]">
                    {(item.info?.meanings ?? []).length ? item.info?.meanings?.join('; ') : 'N/A'}
                  </p>
                </article>
                )
              })}
              {!drillItems.length ? (
                <p className="rounded-lg bg-[var(--han-accent-soft)] px-3 py-2 text-sm font-semibold text-[#8c2f11]">
                  No new words extracted.
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

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close modal"
              onClick={handleCloseEditModal}
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-sm font-bold text-[#5b4f46] transition hover:bg-[#faf6f0]"
            >
              x
            </button>
            <h2 className="text-2xl font-extrabold text-[#1b1714]">Edit Priority Word</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
              Update this word before creating flashcards.
            </p>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7c6e62]">Word</span>
                <input
                  type="text"
                  value={editWord}
                  onChange={(event) => setEditWord(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d8ccbd] bg-white px-3 py-2 text-sm text-[#1b1714] outline-none ring-[#d1451b]/25 transition focus:ring"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7c6e62]">Pronunciation</span>
                <input
                  type="text"
                  value={editPronunciation}
                  onChange={(event) => setEditPronunciation(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d8ccbd] bg-white px-3 py-2 text-sm text-[#1b1714] outline-none ring-[#d1451b]/25 transition focus:ring"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7c6e62]">Meanings</span>
                <textarea
                  value={editMeanings}
                  onChange={(event) => setEditMeanings(event.target.value)}
                  rows={3}
                  placeholder="Use semicolons to separate meanings"
                  className="mt-1 w-full rounded-lg border border-[#d8ccbd] bg-white px-3 py-2 text-sm text-[#1b1714] outline-none ring-[#d1451b]/25 transition focus:ring"
                />
              </label>
            </div>

            {editErrorMessage ? <p className="mt-3 text-sm font-semibold text-[#b42020]">{editErrorMessage}</p> : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSaveEditedDrillItem}
                className="rounded-xl bg-[#d1451b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="rounded-xl border border-[#1b1714] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#faf6f0]"
              >
                Cancel
              </button>
            </div>
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
