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
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isPastingClipboard, setIsPastingClipboard] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const returnState = locationState?.returnToSelection
    if (!returnState) {
      return
    }

    setText(returnState.text)
    setScreening(returnState.screening)
    setSelectedWords(returnState.selectedWords)
    setLoadedFileName(null)
    setErrorMessage(null)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, locationState, navigate])

  const resetSelection = () => {
    setScreening(null)
    setSelectedWords([])
  }

  const applyTextInput = (incomingText: string, sourceFileName?: string) => {
    setText(incomingText)
    setLoadedFileName(sourceFileName ?? null)
    resetSelection()
  }

  const handleFileSelection = async (file: File | null) => {
    if (!file) {
      return
    }

    setIsLoadingFile(true)
    setErrorMessage(null)
    try {
      const fileText = await file.text()
      if (!fileText.trim()) {
        throw new Error('The selected file is empty. Please choose a file with Mandarin text.')
      }
      applyTextInput(fileText, file.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read the selected file.'
      setErrorMessage(message)
    } finally {
      setIsLoadingFile(false)
    }
  }

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard) {
      setErrorMessage('Clipboard access is unavailable in this browser. Paste directly into the text field.')
      return
    }

    setIsPastingClipboard(true)
    setErrorMessage(null)
    try {
      const clipText = await navigator.clipboard.readText()
      if (!clipText.trim()) {
        throw new Error('Clipboard is empty. Copy Mandarin text first and try again.')
      }
      applyTextInput(clipText)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read from clipboard.'
      setErrorMessage(message)
    } finally {
      setIsPastingClipboard(false)
    }
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
      setLoadedFileName(null)
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
        <p className="mt-2 text-sm leading-relaxed text-[#66594f] text-center">Upload or paste Mandarin text to start mining new vocabulary!</p>

        <form onSubmit={handleScreening}>
          <div
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setIsDragOver(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragOver(false)
              const droppedFile = event.dataTransfer.files?.[0] ?? null
              void handleFileSelection(droppedFile)
            }}
            className={`mt-6 rounded-xl border border-dashed p-4 transition ${
              isDragOver ? 'border-[#d1451b] bg-[#fff1e7]' : 'border-[#c9b39b] bg-[#fff8ee]'
            }`}
          >
            <div className="flex justify-center">
              <label className="cursor-pointer rounded-xl border border-[#1b1714] bg-white px-6 py-3 text-sm font-semibold text-[#2d241d] transition hover:bg-[#fff5ea]">
                Select your file
                <input
                  type="file"
                  accept=".txt,.md,.srt"
                  className="sr-only"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null
                    void handleFileSelection(selectedFile)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            </div>

            <p className="mt-3 text-center text-sm text-[#7b654f]">
              or drop it here.
              {/* <button
                type="button"
                onClick={() => void handlePasteFromClipboard()}
                disabled={isPastingClipboard}
                className="font-semibold text-[#8c2f11] underline underline-offset-2 transition hover:text-[#6e220e] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPastingClipboard ? 'reading clipboard...' : 'paste from clipboard'}
              </button> */}
            </p>

            {loadedFileName ? (
              <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#8d7c6f]">Loaded file: {loadedFileName}</p>
            ) : null}
          </div>

          <textarea
            rows={12}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setLoadedFileName(null)
            }}
            placeholder="You can also paste text directly here."
            className="mt-6 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-4 text-sm text-[#2d241d] outline-none ring-[#d1451b] placeholder:text-[#a28d79] focus:ring-2"
          />

          {errorMessage ? <p className="mt-3 text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              type="submit"
              disabled={isScreening || isLoadingFile}
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isScreening ? 'Loading...' : 'Analyze'}
            </button>
            {isLoadingFile ? <p className="self-center text-sm font-semibold text-[#8c2f11]">Loading file...</p> : null}
          </div>
        </form>
      </section>
    </main>
  )
}
