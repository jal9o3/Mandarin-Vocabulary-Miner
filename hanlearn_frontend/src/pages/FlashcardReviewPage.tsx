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

export function FlashcardReviewPage() {
  const [cards, setCards] = useState<FlashcardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [initialDueCount, setInitialDueCount] = useState(0)
  const [totalFlashcards, setTotalFlashcards] = useState(0)

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

      <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10 sm:px-10 lg:px-12">
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
                      <p className="text-2xl text-[#5e5349] font-medium mb-6">
                        {currentCard?.pinyin}
                      </p>

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
      </main>
    </div>
  )
}
