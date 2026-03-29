import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HskWordSelector } from '../components/HskWordSelector'


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

type ReturnToSelectionState = {
  text: string
  screening: ScreeningPayload
  selectedWords: string[]
}

type PasteLocationState = {
  returnToSelection?: ReturnToSelectionState
}

export function PastePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state as PasteLocationState | null) ?? null
  const [text, setText] = useState('')
  const [screening, setScreening] = useState<ScreeningPayload | null>(null)
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [isScreening, setIsScreening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const returnState = locationState?.returnToSelection
    if (returnState) {
      setText(returnState.text)
      setScreening(returnState.screening)
      setSelectedWords(returnState.selectedWords)
      setErrorMessage(null)
      navigate(location.pathname, { replace: true, state: null })
      return
    }
  }, [location.pathname, locationState, navigate])

  const resetSelection = () => {
    setScreening(null)
    setSelectedWords([])
  }

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
        credentials: 'include',
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
          selectionState: {
            text: trimmedText,
            screening,
            selectedWords,
          },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while analyzing text.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (screening) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10">
        <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
          <button
            type="button"
            onClick={resetSelection}
            className="mb-2 rounded-xl border border-[#1b1714] bg-white/80 px-4 py-2 text-sm font-semibold transition hover:bg-white"
          >
            ← Back
          </button>
          <HskWordSelector
            screening={screening}
            selectedWords={selectedWords}
            onToggleWord={toggleWord}
            onSelectGroup={selectGroup}
            onClearGroup={clearGroup}
          />

          {errorMessage ? <p className="mt-4 text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            
            <button
              type="button"
              onClick={() => setSelectedWords([])}
              className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isSubmitting}
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Loading...' : 'Confirm'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714] text-center">Vocab Miner</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f] text-center">Paste Mandarin text to start mining new vocabulary.</p>

        <form onSubmit={handleScreening}>
          <textarea
            rows={12}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
            }}
            placeholder="Paste Mandarin text here."
            className="mt-6 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-4 text-sm text-[#2d241d] outline-none ring-[#d1451b] placeholder:text-[#a28d79] focus:ring-2"
          />

          {errorMessage ? <p className="mt-3 text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              type="submit"
              disabled={isScreening}
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isScreening ? 'Loading...' : 'Analyze'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
