import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type FlashcardData = {
  id: number
  word: string
  pinyin: string
  meaning: string
  created_at: string
}

type FlashcardRow = {
  id: unknown
  word: unknown
  pinyin: unknown
  meaning: unknown
  created_at: unknown
}

export function FlashcardReviewPage() {
  const [cards, setCards] = useState<FlashcardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const hasCards = cards.length > 0
  const currentCard = hasCards ? cards[currentIndex] : null
  const totalCards = cards.length

  useEffect(() => {
    const loadFlashcards = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`${API_BASE_URL}/api/flashcards`, {
          method: 'GET',
          credentials: 'include',
        })

        const payload = (await response.json()) as {
          error?: unknown
          flashcards?: FlashcardRow[]
        }

        if (!response.ok) {
          const error = typeof payload.error === 'string' ? payload.error : 'Failed to load flashcards.'
          throw new Error(error)
        }

        const validRows: Array<{
          id: number
          word: string
          pinyin: string
          meaning: string
          created_at: string
        }> = []

        for (const row of payload.flashcards ?? []) {
          if (typeof row.id !== 'number') continue
          if (typeof row.word !== 'string') continue
          if (typeof row.meaning !== 'string') continue
          if (typeof row.pinyin !== 'string') continue
          if (typeof row.created_at !== 'string') continue
          validRows.push({
            id: row.id,
            word: row.word.trim(),
            pinyin: row.pinyin,
            meaning: row.meaning,
            created_at: row.created_at,
          })
        }

        const grouped = new Map<
          string,
          {
            id: number
            word: string
            pinyin: string
            created_at: string
            meanings: string[]
            meaningSet: Set<string>
          }
        >()

        for (const row of validRows) {
          const meaningParts = row.meaning
            .split(';')
            .map((part) => part.trim())
            .filter((part) => part.length > 0)

          const existing = grouped.get(row.word)
          if (!existing) {
            grouped.set(row.word, {
              id: row.id,
              word: row.word,
              pinyin: row.pinyin,
              created_at: row.created_at,
              meanings: [...meaningParts],
              meaningSet: new Set(meaningParts),
            })
            continue
          }

          if (!existing.pinyin && row.pinyin) {
            existing.pinyin = row.pinyin
          }

          for (const part of meaningParts) {
            if (existing.meaningSet.has(part)) {
              continue
            }
            existing.meanings.push(part)
            existing.meaningSet.add(part)
          }

          if (new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
            existing.id = row.id
            existing.created_at = row.created_at
          }
        }

        const nextCards: FlashcardData[] = Array.from(grouped.values()).map((entry) => {
          const combinedMeaning = entry.meanings.length ? entry.meanings.join('; ') : 'No meaning available.'
          return {
            id: entry.id,
            word: entry.word,
            pinyin: entry.pinyin,
            created_at: entry.created_at,
            meaning: combinedMeaning,
          }
        })

        nextCards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setCards(nextCards)
        setCurrentIndex(0)
        setIsFlipped(false)
        setIsComplete(false)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error while loading flashcards.'
        setErrorMessage(message)
      } finally {
        setIsLoading(false)
      }
    }

    void loadFlashcards()
  }, [])

  const handleRevealWord = () => {
    setIsFlipped(true)
  }

  const handleRating = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return
    console.log(`Rated card ${currentCard.id} as: ${rating}`)
    // Reset card and move to next
    setIsFlipped(false)
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setIsComplete(true)
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
        ) : !hasCards ? (
          // Empty state
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-xl font-semibold text-[#75695f]">
                Extract words in the miner to create flashcards.
              </p>
            </div>
          </div>
        ) : isComplete ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-3xl font-bold text-[#1b1714]">Deck complete</p>
              <p className="mt-3 text-[#75695f]">You reviewed all saved flashcards.</p>
              <button
                onClick={() => {
                  setCurrentIndex(0)
                  setIsFlipped(false)
                  setIsComplete(false)
                }}
                className="mt-6 px-6 py-3 rounded-xl bg-[#d1451b] text-white font-semibold transition hover:bg-[#b63e19]"
              >
                Start over
              </button>
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
                  Card {currentIndex + 1} of {totalCards}
                </p>
              </div>
              <div className="text-right">
                <div className="h-3 w-48 rounded-full bg-[#e6d5c3] overflow-hidden">
                  <div
                    className="h-full bg-[#d1451b] transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
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
                  onClick={() => handleRating('again')}
                  className="py-3 px-4 rounded-lg bg-[#ff6b6b] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#ff5252] shadow-lg shadow-[#ff6b6b]/20 active:translate-y-0"
                >
                  Again
                </button>
                <button
                  onClick={() => handleRating('hard')}
                  className="py-3 px-4 rounded-lg bg-[#ffa94d] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#ff922b] shadow-lg shadow-[#ffa94d]/20 active:translate-y-0"
                >
                  Hard
                </button>
                <button
                  onClick={() => handleRating('good')}
                  className="py-3 px-4 rounded-lg bg-[#74b446] text-white font-semibold text-sm transition hover:-translate-y-0.5 hover:bg-[#5a9838] shadow-lg shadow-[#74b446]/20 active:translate-y-0"
                >
                  Good
                </button>
                <button
                  onClick={() => handleRating('easy')}
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
