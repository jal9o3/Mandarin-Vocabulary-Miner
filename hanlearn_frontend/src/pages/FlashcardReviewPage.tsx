import { useState } from 'react'

type FlashcardData = {
  id: number
  word: string
  pronunciation: string
  meaning: string
}

const PLACEHOLDER_CARDS: FlashcardData[] = []

export function FlashcardReviewPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  const cards = PLACEHOLDER_CARDS
  const hasCards = cards.length > 0
  const currentCard = hasCards ? cards[currentIndex] : null
  const totalCards = cards.length

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
      // Deck complete - could show completion screen
      console.log('Deck complete!')
    }
  }

  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-[#fffbf4] to-[#f0e6d8]">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#f6aa72]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-80 h-72 w-72 rounded-full bg-[#d1451b]/10 blur-3xl" />

      <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10 sm:px-10 lg:px-12">
        {!hasCards ? (
          // Empty state
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-xl font-semibold text-[#75695f]">
                Extract words in the miner to create flashcards.
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
                      <p className="text-5xl font-bold text-[#1b1714] leading-tight mb-8">
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
                        {currentCard?.pronunciation}
                      </p>

                      <div className="h-px bg-[#e6d5c3] my-6" />

                      <p className="mono text-xs uppercase tracking-[0.2em] text-[#8a7a6a] mb-2">
                        Meaning
                      </p>
                      <p className="text-xl text-[#4c423a] font-semibold mb-8">
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
