import { useCallback, useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const buildApiUrl = (path: string, searchParams?: URLSearchParams) => {
  const base = API_BASE_URL.replace(/\/$/, '')
  const url = `${base}${path}`
  const query = searchParams?.toString()
  return query ? `${url}?${query}` : url
}

const parseApiJson = async <T,>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const body = await response.text()
    const preview = body.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')) {
      throw new Error('API returned HTML instead of JSON. Check that the Django server is running and that /api is reaching it.')
    }

    throw new Error(preview || `Unexpected API response (${response.status}).`)
  }

  return (await response.json()) as T
}

type Rating = 'again' | 'hard' | 'good' | 'easy'

type FlashcardData = {
  id: number
  word: string
  pinyin: string
  meaning: string
  created_at: string
  due_at: string
  last_reviewed_at: string | null
  interval_days: number
  ease_factor: number
  consecutive_correct_reviews: number
  review_count: number
  lapse_count: number
}

type FlashcardRow = {
  id: unknown
  word: unknown
  pinyin: unknown
  meaning: unknown
  created_at: unknown
  due_at: unknown
  last_reviewed_at?: unknown
  interval_days?: unknown
  ease_factor?: unknown
  consecutive_correct_reviews?: unknown
  review_count?: unknown
  lapse_count?: unknown
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

export function FlashcardReviewPage() {
  const [cards, setCards] = useState<FlashcardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [initialDueCount, setInitialDueCount] = useState(0)
  const [totalFlashcards, setTotalFlashcards] = useState(0)
  const [viewMode, setViewMode] = useState<'review' | 'table'>('review')
  const [allCards, setAllCards] = useState<FlashcardData[]>([])
  const [isLoadingAll, setIsLoadingAll] = useState(false)
  const [showPinyin, setShowPinyin] = useState(true)

  const hasCards = cards.length > 0
  const currentCard = hasCards ? cards[0] : null
  const remainingCards = cards.length
  const reviewedCards = Math.max(0, initialDueCount - remainingCards)
  const progressWidth = initialDueCount > 0 ? (reviewedCards / initialDueCount) * 100 : 0

  const loadFlashcards = useCallback(async (showCompletionOnEmpty = false) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const searchParams = new URLSearchParams({ due_only: '1' })

      const response = await fetch(buildApiUrl('/api/flashcards', searchParams), {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      const payload = await parseApiJson<{
        error?: unknown
        flashcards?: FlashcardRow[]
        total?: unknown
        due?: unknown
      }>(response)

      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to load flashcards.'
        throw new Error(error)
      }

      const validRows: FlashcardData[] = []

      for (const row of payload.flashcards ?? []) {
        if (typeof row.id !== 'number') continue
        if (typeof row.word !== 'string') continue
        if (typeof row.meaning !== 'string') continue
        if (typeof row.pinyin !== 'string') continue
        if (typeof row.created_at !== 'string') continue
        if (typeof row.due_at !== 'string') continue
        validRows.push({
          id: row.id,
          word: row.word.trim(),
          pinyin: row.pinyin,
          meaning: row.meaning,
          created_at: row.created_at,
          due_at: row.due_at,
          last_reviewed_at: typeof row.last_reviewed_at === 'string' ? row.last_reviewed_at : null,
          interval_days: typeof row.interval_days === 'number' ? row.interval_days : 0,
          ease_factor: typeof row.ease_factor === 'number' ? row.ease_factor : 2.5,
          consecutive_correct_reviews:
            typeof row.consecutive_correct_reviews === 'number' ? row.consecutive_correct_reviews : 0,
          review_count: typeof row.review_count === 'number' ? row.review_count : 0,
          lapse_count: typeof row.lapse_count === 'number' ? row.lapse_count : 0,
        })
      }

      validRows.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())

      const dueCount = typeof payload.due === 'number' ? payload.due : validRows.length
      setCards(validRows)
      setInitialDueCount(dueCount)
      setTotalFlashcards(typeof payload.total === 'number' ? payload.total : validRows.length)
      setIsFlipped(false)
      setIsComplete(showCompletionOnEmpty && dueCount === 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while loading flashcards.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFlashcards()
  }, [loadFlashcards])

  const loadAllFlashcards = useCallback(async () => {
    setIsLoadingAll(true)
    setErrorMessage(null)
    try {
      const response = await fetch(buildApiUrl('/api/flashcards'), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const payload = await parseApiJson<{
        error?: unknown
        flashcards?: FlashcardRow[]
      }>(response)
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to load flashcards.'
        throw new Error(error)
      }
      const validRows: FlashcardData[] = []
      for (const row of payload.flashcards ?? []) {
        if (typeof row.id !== 'number') continue
        if (typeof row.word !== 'string') continue
        if (typeof row.meaning !== 'string') continue
        if (typeof row.pinyin !== 'string') continue
        if (typeof row.created_at !== 'string') continue
        if (typeof row.due_at !== 'string') continue
        validRows.push({
          id: row.id,
          word: row.word.trim(),
          pinyin: row.pinyin,
          meaning: row.meaning,
          created_at: row.created_at,
          due_at: row.due_at,
          last_reviewed_at: typeof row.last_reviewed_at === 'string' ? row.last_reviewed_at : null,
          interval_days: typeof row.interval_days === 'number' ? row.interval_days : 0,
          ease_factor: typeof row.ease_factor === 'number' ? row.ease_factor : 2.5,
          consecutive_correct_reviews:
            typeof row.consecutive_correct_reviews === 'number' ? row.consecutive_correct_reviews : 0,
          review_count: typeof row.review_count === 'number' ? row.review_count : 0,
          lapse_count: typeof row.lapse_count === 'number' ? row.lapse_count : 0,
        })
      }
      validRows.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      setAllCards(validRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while loading flashcards.'
      setErrorMessage(message)
    } finally {
      setIsLoadingAll(false)
    }
  }, [])

  const handleReviewView = () => {
    setViewMode('review')
  }

  const handleManageView = () => {
    setViewMode('table')
    void loadAllFlashcards()
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleRevealWord = () => {
    setIsFlipped(true)
  }

  const handleRating = async (rating: Rating) => {
    if (!currentCard) return

    setIsSubmittingReview(true)
    setErrorMessage(null)

    try {
      const response = await fetch(buildApiUrl(`/api/flashcards/${currentCard.id}/review`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ rating }),
      })

      const payload = await parseApiJson<{ error?: unknown }>(response)
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to save review.'
        throw new Error(error)
      }

      await loadFlashcards(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while saving review.'
      setErrorMessage(message)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-[#fffbf4] to-[#f0e6d8]">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#f6aa72]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-80 h-72 w-72 rounded-full bg-[#d1451b]/10 blur-3xl" />

      {/* View toggle — fixed top-right, outside main so it never shifts */}
      <div className="fixed right-4 top-20 z-50 sm:top-24">
        <div className="inline-flex rounded-xl bg-[#e6d5c3] p-1 gap-1 shadow-md">
          <button
            onClick={handleReviewView}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              viewMode === 'review'
                ? 'bg-white text-[#1b1714] shadow-sm'
                : 'text-[#75695f] hover:text-[#1b1714]'
            }`}
          >
            Review
          </button>
          <button
            onClick={handleManageView}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              viewMode === 'table'
                ? 'bg-white text-[#1b1714] shadow-sm'
                : 'text-[#75695f] hover:text-[#1b1714]'
            }`}
          >
            Manage
          </button>
        </div>
      </div>

      <main className={`mx-auto min-h-screen w-full px-6 py-10 sm:px-10 lg:px-12 ${viewMode === 'table' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {viewMode === 'review' ? (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-xl font-semibold text-[#75695f]">Loading flashcards...</p>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center max-w-md">
                  <p className="text-xl font-semibold text-[#8c2f11]">{errorMessage}</p>
                </div>
              </div>
            ) : isComplete ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#1b1714]">Deck complete</p>
                  <p className="mt-3 text-[#75695f]">You reviewed every flashcard that was due.</p>
                  <button
                    onClick={() => {
                      setIsFlipped(false)
                      setIsComplete(false)
                      void window.location.reload()
                    }}
                    className="mt-6 px-6 py-3 rounded-xl bg-[#d1451b] text-white font-semibold transition hover:bg-[#b63e19]"
                  >
                    Refresh due deck
                  </button>
                </div>
              </div>
            ) : !hasCards ? (
              // Empty state
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-xl font-semibold text-[#75695f]">
                    {totalFlashcards > 0 ? 'No flashcards are due right now.' : 'Extract words in the miner to create flashcards.'}
                  </p>
                </div>
              </div>
            ) : (
              // Flashcard content
              <>
                {/* Header */}
                <div className="mb-12 flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-[#1b1714]">Review Flashcards</h1>
                    <p className="mt-1 text-sm text-[#75695f]">
                      {remainingCards} due now out of {totalFlashcards} saved
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="h-3 w-48 rounded-full bg-[#e6d5c3] overflow-hidden">
                      <div
                        className="h-full bg-[#d1451b] transition-all duration-300"
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Flashcard Container */}
                <div className="mb-8 perspective">
                  {!isFlipped ? (
                    // Front of card - Meaning
                    <div className="group h-96 relative">
                      <div className="absolute inset-0 rounded-3xl border-2 border-[#d6c7b6] bg-white shadow-2xl shadow-[#bf9f83]/20 p-8 flex flex-col items-center justify-center transform transition-transform hover:shadow-2xl hover:shadow-[#bf9f83]/30">
                        <div className="text-center">
                          <p className="mono text-xs uppercase tracking-[0.2em] text-[#8a7a6a] mb-4">
                            Meaning
                          </p>
                          <p className="mb-8 max-h-48 overflow-y-auto px-2 text-base font-semibold leading-relaxed text-[#1b1714] sm:text-lg break-words">
                            {currentCard?.meaning}
                          </p>
                          <button
                            onClick={handleRevealWord}
                            className="px-8 py-3 rounded-xl bg-[#d1451b] text-white font-semibold text-lg shadow-lg shadow-[#d1451b]/20 transition hover:-translate-y-0.5 hover:bg-[#b63e19] active:translate-y-0"
                          >
                            Reveal Word
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Back of card - Word, Pronunciation, Meaning
                    <div className="group h-96 relative">
                      <div className="absolute inset-0 rounded-3xl border-2 border-[#d6c7b6] bg-gradient-to-br from-[#fff4e8] to-white shadow-2xl shadow-[#bf9f83]/20 p-8 flex flex-col items-center justify-center transform transition-transform">
                        <div className="text-center w-full">
                          <p className="mono text-xs uppercase tracking-[0.2em] text-[#8a7a6a] mb-4">
                            Word
                          </p>
                          <p className="text-6xl font-bold text-[#d1451b] mb-3">
                            {currentCard?.word}
                          </p>
                          <div className="mb-6 flex justify-center">
                            <div className="relative inline-flex items-center">
                              <p className="text-2xl text-[#5e5349] font-medium">
                                {showPinyin ? currentCard?.pinyin : '••••••'}
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowPinyin((current) => !current)}
                                className="absolute left-full ml-2 inline-flex items-center justify-center rounded-md bg-transparent p-1.5 text-[#75695f] transition hover:text-[#5e5349]"
                                aria-label={showPinyin ? 'Hide pinyin' : 'Show pinyin'}
                                title={showPinyin ? 'Hide pinyin' : 'Show pinyin'}
                              >
                                <EyeIcon open={showPinyin} />
                              </button>
                            </div>
                          </div>

                          <p className="mb-2 text-sm font-medium text-[#8a7a6a]">
                            Current interval: {currentCard?.interval_days ?? 0} day{currentCard?.interval_days === 1 ? '' : 's'}
                          </p>

                          <div className="h-px bg-[#e6d5c3] my-6" />

                          <p className="mono text-xs uppercase tracking-[0.2em] text-[#8a7a6a] mb-2">
                            Meaning
                          </p>
                          <p className="mb-8 max-h-36 overflow-y-auto px-2 text-sm font-medium leading-relaxed text-[#4c423a] sm:text-base break-words">
                            {currentCard?.meaning}
                          </p>
                        </div>
                      </div>
                </div>
              )}
            </div>

            {/* Rating Buttons */}
            {isFlipped && (
              <div className="grid grid-cols-4 gap-3">
                <button
                  onClick={() => void handleRating('again')}
                  disabled={isSubmittingReview}
                  className="py-3 px-4 rounded-lg bg-[#ff6b6b] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#ff5252] shadow-lg shadow-[#ff6b6b]/20 active:translate-y-0"
                >
                  Again
                </button>
                <button
                  onClick={() => void handleRating('hard')}
                  disabled={isSubmittingReview}
                  className="py-3 px-4 rounded-lg bg-[#ffa94d] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#ff922b] shadow-lg shadow-[#ffa94d]/20 active:translate-y-0"
                >
                  Hard
                </button>
                <button
                  onClick={() => void handleRating('good')}
                  disabled={isSubmittingReview}
                  className="py-3 px-4 rounded-lg bg-[#74b446] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#5a9838] shadow-lg shadow-[#74b446]/20 active:translate-y-0"
                >
                  Good
                </button>
                <button
                  onClick={() => void handleRating('easy')}
                  disabled={isSubmittingReview}
                  className="py-3 px-4 rounded-lg bg-[#15aabf] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#1098ad] shadow-lg shadow-[#15aabf]/20 active:translate-y-0"
                >
                  Easy
                </button>
              </div>
            )}

                {/* Card footer - hidden until revealed */}
                {isFlipped && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setIsFlipped(false)}
                      className="text-sm font-medium text-[#75695f] hover:text-[#5e5349] transition"
                    >
                      Hide word
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          // Table view
          <>
            {isLoadingAll ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-xl font-semibold text-[#75695f]">Loading flashcards...</p>
              </div>
            ) : errorMessage ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-xl font-semibold text-[#8c2f11]">{errorMessage}</p>
              </div>
            ) : allCards.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-xl font-semibold text-[#75695f]">No flashcards found.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-[#1b1714]">All Flashcards</h1>
                  <p className="mt-1 text-sm text-[#75695f]">
                    {allCards.length} card{allCards.length === 1 ? '' : 's'} total
                  </p>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-[#d6c7b6] bg-white shadow-lg shadow-[#bf9f83]/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e6d5c3] bg-[#faf5ef]">
                        <th className="px-4 py-3 text-left font-semibold text-[#5e5349]">Word</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#5e5349]">Pinyin</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#5e5349]">Meaning</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#5e5349]">Created</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#5e5349]">Due</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#5e5349]">Last Reviewed</th>
                        <th className="px-4 py-3 text-right font-semibold text-[#5e5349]">Interval</th>
                        <th className="px-4 py-3 text-right font-semibold text-[#5e5349]">Ease</th>
                        <th className="px-4 py-3 text-right font-semibold text-[#5e5349]">Reviews</th>
                        <th className="px-4 py-3 text-right font-semibold text-[#5e5349]">Lapses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCards.map((card, i) => (
                        <tr
                          key={card.id}
                          className={`border-b border-[#f0e6d8] transition-colors hover:bg-[#fdf8f2] ${
                            i % 2 === 0 ? 'bg-white' : 'bg-[#fdfaf6]'
                          }`}
                        >
                          <td className="px-4 py-3 font-bold text-[#d1451b] text-base">{card.word}</td>
                          <td className="px-4 py-3 text-[#5e5349]">{card.pinyin}</td>
                          <td className="px-4 py-3 text-[#1b1714] max-w-xs">
                            <span className="line-clamp-2">{card.meaning}</span>
                          </td>
                          <td className="px-4 py-3 text-[#75695f] whitespace-nowrap">{formatDate(card.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                new Date(card.due_at) <= new Date()
                                  ? 'bg-[#ffeded] text-[#c0392b]'
                                  : 'bg-[#edf6e8] text-[#3a7d44]'
                              }`}
                            >
                              {formatDate(card.due_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#75695f] whitespace-nowrap">{formatDate(card.last_reviewed_at)}</td>
                          <td className="px-4 py-3 text-right text-[#5e5349]">{card.interval_days}d</td>
                          <td className="px-4 py-3 text-right text-[#5e5349]">{card.ease_factor.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-[#5e5349]">{card.review_count}</td>
                          <td className="px-4 py-3 text-right text-[#5e5349]">{card.lapse_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
