import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type ScreeningWord = {
  word: string
  pinyin: string
  occurrences: number
}

type ScreeningGroup = {
  level: string
  words: ScreeningWord[]
}

type ScreeningPayload = {
  cleaned_text: string
  total_unique_words: number
  total_occurrences: number
  groups: ScreeningGroup[]
}

export function PastePage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [screening, setScreening] = useState<ScreeningPayload | null>(null)
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [isScreening, setIsScreening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const allWordEntries = useMemo(
    () =>
      (screening?.groups ?? []).flatMap((group) =>
        group.words.map((entry) => ({
          level: group.level,
          ...entry,
        })),
      ),
    [screening],
  )

  const selectedWordSet = useMemo(() => new Set(selectedWords), [selectedWords])

  const toggleWord = (word: string) => {
    setSelectedWords((current) =>
      current.includes(word) ? current.filter((item) => item !== word) : [...current, word],
    )
  }

  const selectGroup = (group: ScreeningGroup) => {
    setSelectedWords((current) => {
      const merged = new Set(current)
      for (const entry of group.words) {
        merged.add(entry.word)
      }
      return [...merged]
    })
  }

  const clearGroup = (group: ScreeningGroup) => {
    const groupWords = new Set(group.words.map((entry) => entry.word))
    setSelectedWords((current) => current.filter((word) => !groupWords.has(word)))
  }

  const handleScreening = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedText = text.trim()
    if (!trimmedText) {
      setErrorMessage('Please paste Mandarin text before starting vocabulary selection.')
      return
    }

    setIsScreening(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocab-screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedText }),
      })

      const payload = (await response.json()) as Partial<ScreeningPayload> & { error?: unknown }
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to determine vocabulary list.'
        throw new Error(error)
      }

      const groups = Array.isArray(payload.groups) ? payload.groups : []
      setScreening({
        cleaned_text: typeof payload.cleaned_text === 'string' ? payload.cleaned_text : trimmedText,
        total_unique_words: typeof payload.total_unique_words === 'number' ? payload.total_unique_words : 0,
        total_occurrences: typeof payload.total_occurrences === 'number' ? payload.total_occurrences : 0,
        groups,
      })
      setSelectedWords([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while loading vocabulary screen.'
      setErrorMessage(message)
    } finally {
      setIsScreening(false)
    }
  }

  const handleAnalyze = async () => {
    const trimmedText = text.trim()
    if (!trimmedText) {
      setErrorMessage('Please paste Mandarin text before analyzing.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmedText,
          vocab_text: selectedWords.join(' '),
        }),
      })

      const payload = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to analyze passage.'
        throw new Error(error)
      }

      navigate('/analyze', {
        state: {
          analysis: payload,
          sourceText: trimmedText,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while analyzing text.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasVocabularyStep = screening !== null
  const totalScreeningWords = allWordEntries.length

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Paste Mandarin Passage</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Guest users must first select known words from HSK 1-9 groups before passage analysis runs.
        </p>

        <form onSubmit={handleScreening}>
          <textarea
            rows={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste Mandarin text here..."
            className="mt-6 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-4 text-sm text-[#2d241d] outline-none ring-[#d1451b] placeholder:text-[#a28d79] focus:ring-2"
          />

          {errorMessage ? <p className="mt-3 text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isScreening}
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isScreening ? 'Building HSK Lists...' : hasVocabularyStep ? 'Refresh HSK Word Groups' : 'Start Vocabulary Selection'}
            </button>
            <Link
              to="/upload"
              className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
            >
              Switch to Upload Mode
            </Link>
          </div>
        </form>

        {hasVocabularyStep ? (
          <section className="mt-8 rounded-xl border border-[#e6dbc9] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#1b1714]">Step 2: Select Known Words</h2>
                <p className="mt-1 text-sm text-[#66594f]">
                  {screening.total_unique_words} unique words detected. Select the words you already know from each HSK band.
                </p>
              </div>
              <p className="rounded-full bg-[#fff1e5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#8c2f11]">
                Selected: {selectedWords.length}/{totalScreeningWords}
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              {screening.groups.map((group) => (
                <article key={group.level} className="rounded-lg border border-[#eddcc8] bg-[#fffaf2] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[#2b211b]">{group.level}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectGroup(group)}
                        className="rounded-full border border-[#d3b89e] bg-white px-3 py-1 text-xs font-semibold text-[#5d4a3a] transition hover:bg-[#fff3e8]"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => clearGroup(group)}
                        className="rounded-full border border-[#d3b89e] bg-white px-3 py-1 text-xs font-semibold text-[#5d4a3a] transition hover:bg-[#fff3e8]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {group.words.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.words.map((entry) => {
                        const checked = selectedWordSet.has(entry.word)
                        return (
                          <label
                            key={`${group.level}-${entry.word}`}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              checked
                                ? 'border-[#d1451b] bg-[#fff0e8] text-[#8c2f11]'
                                : 'border-[#d8ccbd] bg-white text-[#4e4138] hover:bg-[#fff7ef]'
                            }`}
                            title={`${entry.pinyin} | ${entry.occurrences} occurrences`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWord(entry.word)}
                              className="h-3.5 w-3.5 rounded border-[#bba890] text-[#d1451b]"
                            />
                            <span>{entry.word}</span>
                            <span className="mono text-[10px] uppercase tracking-[0.1em] text-[#8d7c6f]">
                              {entry.occurrences}x
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[#8d7c6f]">No words detected in this band.</p>
                  )}
                </article>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isSubmitting || isScreening}
                className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Analyzing...' : 'Analyze with Selected Vocabulary'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedWords([])}
                className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
              >
                Clear All Selections
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
