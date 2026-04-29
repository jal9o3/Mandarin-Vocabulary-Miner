import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HskWordSelector } from '../components/HskWordSelector'
import { BusyRetryBanner } from '../components/LoadingWithRetry'
import { API_BASE_URL } from '../lib/apiBase'
import { analyzeTextFrontend, buildVocabScreenFrontend } from '../lib/frontendAnalysis'
import { attachTimeout, isAbortError, isBackendConnectionFailure } from '../lib/requestUtils'


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

const USE_FRONTEND_ANALYSIS = import.meta.env.VITE_FRONTEND_ANALYSIS !== 'false'
const NO_MEANING_FALLBACK = 'No meaning found in current wordlists.'

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
  const [isScreeningTimedOut, setIsScreeningTimedOut] = useState(false)
  const [isScreeningTimeoutExhausted, setIsScreeningTimeoutExhausted] = useState(false)
  const screeningControllerRef = useRef<AbortController | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingTimedOut, setIsSubmittingTimedOut] = useState(false)
  const [isSubmittingTimeoutExhausted, setIsSubmittingTimeoutExhausted] = useState(false)
  const submittingControllerRef = useRef<AbortController | null>(null)
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

  const doScreeningBackend = async (trimmedText: string) => {
    setIsScreeningTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsScreeningTimedOut, screeningControllerRef)
    setIsScreening(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocab-screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedText }),
        signal: screeningControllerRef.current?.signal,
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
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsScreeningTimedOut(true)
        return
      }
      const message = error instanceof Error ? error.message : 'Unexpected error while loading vocabulary screen.'
      setErrorMessage(message)
    } finally {
      clearTimer()
      setIsScreening(false)
    }
  }

  const doScreening = async (trimmedText: string) => {
    if (!USE_FRONTEND_ANALYSIS) {
      await doScreeningBackend(trimmedText)
      return
    }

    setIsScreening(false)
    setIsScreeningTimedOut(false)
    setIsScreeningTimeoutExhausted(false)
    setErrorMessage(null)

    try {
      setIsScreening(true)
      const payload = await buildVocabScreenFrontend(trimmedText)
      setScreening(payload)
      setSelectedWords([])
      return
    } catch {
      // Fall back to backend analysis if local wordlist assets are unavailable.
    } finally {
      setIsScreening(false)
    }

    await doScreeningBackend(trimmedText)
  }

  const handleScreening = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedText = text.trim()
    if (!trimmedText) {
      setErrorMessage('Please paste Mandarin text before starting vocabulary selection.')
      return
    }

    await doScreening(trimmedText)
  }

  const doAnalyzeBackend = async (trimmedText: string) => {
    setIsSubmittingTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsSubmittingTimedOut, submittingControllerRef)
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
        signal: submittingControllerRef.current?.signal,
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
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsSubmittingTimedOut(true)
        return
      }
      const message = error instanceof Error ? error.message : 'Unexpected error while analyzing text.'
      setErrorMessage(message)
    } finally {
      clearTimer()
      setIsSubmitting(false)
    }
  }

  const doAnalyze = async (trimmedText: string) => {
    if (!USE_FRONTEND_ANALYSIS) {
      await doAnalyzeBackend(trimmedText)
      return
    }

    setIsSubmitting(false)
    setIsSubmittingTimedOut(false)
    setIsSubmittingTimeoutExhausted(false)
    setErrorMessage(null)

    try {
      setIsSubmitting(true)
      const payload = await analyzeTextFrontend(trimmedText, selectedWords)

      const drillSet = Array.isArray(payload.priority_drill_set) ? payload.priority_drill_set : []
      const unresolvedCount = drillSet.filter((item) => {
        const pronunciation = item.info?.pronunciation?.trim() ?? ''
        const meanings = Array.isArray(item.info?.meanings) ? item.info.meanings : []
        if (!pronunciation || !meanings.length) {
          return true
        }

        return meanings.length === 1 && meanings[0] === NO_MEANING_FALLBACK
      }).length

      // If almost all priority entries are unresolved, defer to backend enrichment.
      if (drillSet.length >= 4 && unresolvedCount >= Math.max(drillSet.length - 1, 3)) {
        await doAnalyzeBackend(trimmedText)
        return
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
      return
    } catch {
      // Fall back to backend analysis if local analysis fails.
    } finally {
      setIsSubmitting(false)
    }

    await doAnalyzeBackend(trimmedText)
  }

  const handleAnalyze = () => {
    const trimmedText = text.trim()
    if (!trimmedText) {
      setErrorMessage('Please paste Mandarin text before analyzing.')
      return
    }

    void doAnalyze(trimmedText)
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
              disabled={isSubmitting || (isSubmittingTimedOut && !isSubmittingTimeoutExhausted)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isSubmitting ? 'Loading…' : 'Confirm'}
            </button>
          </div>
          <BusyRetryBanner
            active={isSubmittingTimedOut}
            onExhausted={() => setIsSubmittingTimeoutExhausted(true)}
          />
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
              disabled={isScreening || (isScreeningTimedOut && !isScreeningTimeoutExhausted)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isScreening && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isScreening ? 'Loading…' : 'Analyze'}
            </button>
          </div>
          <BusyRetryBanner
            active={isScreeningTimedOut}
            onExhausted={() => setIsScreeningTimeoutExhausted(true)}
          />
        </form>
      </section>
    </main>
  )
}
