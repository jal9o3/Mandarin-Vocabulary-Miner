import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { useAuth } from '../lib/auth'
import { buildSentencePinyinLines, PINYIN_UNAVAILABLE_FALLBACK } from '../lib/frontendAnalysis'
import { BusyRetryBanner, LoadingCard } from '../components/LoadingWithRetry'
import { attachTimeout, isAbortError, isBackendConnectionFailure } from '../lib/requestUtils'

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const PINYIN_LOADING_PLACEHOLDER = 'loading pinyin...'

type SavedText = {
  id: number
  title: string
  content: string
  hsk_level: number
  created_at: string
}

type SentenceSegment = {
  text: string
}

const SENTENCE_END_PUNCTUATION = /[。！？!?；;:]/

function splitContentIntoSentences(content: string): SentenceSegment[] {
  const normalized = content.replaceAll('\r\n', '\n')
  const segments: SentenceSegment[] = []
  let buffer = ''

  for (const char of Array.from(normalized)) {
    if (char === '\n') {
      const trimmed = buffer.trim()
      if (trimmed) {
        segments.push({ text: trimmed })
      }
      buffer = ''
      continue
    }

    buffer += char
    if (!SENTENCE_END_PUNCTUATION.test(char)) {
      continue
    }

    const trimmed = buffer.trim()
    if (trimmed) {
      segments.push({ text: trimmed })
    }
    buffer = ''
  }

  const remaining = buffer.trim()
  if (remaining) {
    segments.push({ text: remaining })
  }

  return segments
}

function DotsVerticalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}

function SpeakerIcon() {
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
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 010 7" />
      <path d="M18.5 6a8.5 8.5 0 010 12" />
    </svg>
  )
}

function TextCard({
  text,
  onOpen,
  onEdit,
  onDelete,
}: {
  text: SavedText
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const cardLabel = text.title || text.content.slice(0, 40)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="group w-28 shrink-0 sm:w-32">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full"
          aria-label={`Open: ${cardLabel}`}
        >
          <div className="flex h-32 w-full items-center justify-center rounded-lg border border-[#d8cab8] bg-gradient-to-b from-[#fff9f0] via-[#f6e7d5] to-[#efd8bf] px-2 py-3 text-center shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-36">
            <p className="line-clamp-4 text-xs font-semibold leading-snug text-[#4a3e35]">
              {cardLabel}
            </p>
          </div>
        </button>

        <div ref={menuRef} className="absolute right-1 top-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            aria-label="Options"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/70 text-[#5e5349] opacity-0 transition hover:bg-white hover:text-[#1b1714] group-hover:opacity-100"
            style={{ opacity: menuOpen ? 1 : undefined }}
          >
            <DotsVerticalIcon />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-7 z-20 min-w-[110px] rounded-xl border border-[#e0d3c1] bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="block w-full px-4 py-2 text-left text-sm font-semibold text-[#2f261f] transition hover:bg-[#fff4e8]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="block w-full px-4 py-2 text-left text-sm font-semibold text-[#b42020] transition hover:bg-[#fff0f0]"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function LibraryPage() {
  const { isAuthenticated, status } = useAuth()
  const [texts, setTexts] = useState<SavedText[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTimedOut, setIsLoadingTimedOut] = useState(false)
  const loadingControllerRef = useRef<AbortController | null>(null)

  // Reading modal state
  const [readingText, setReadingText] = useState<SavedText | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null)
  const [showPinyin, setShowPinyin] = useState(false)
  const [sentencePinyinLines, setSentencePinyinLines] = useState<string[]>([])
  const [isPinyinLoading, setIsPinyinLoading] = useState(false)
  const playbackSessionIdRef = useRef(0)
  const sentenceBodyRef = useRef<HTMLDivElement | null>(null)
  const sentenceRowRefs = useRef(new Map<number, HTMLButtonElement>())

  // Edit modal state
  const [editingText, setEditingText] = useState<SavedText | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isEditTimedOut, setIsEditTimedOut] = useState(false)
  const [isEditTimeoutExhausted, setIsEditTimeoutExhausted] = useState(false)
  const editControllerRef = useRef<AbortController | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation state
  const [deletingText, setDeletingText] = useState<SavedText | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteTimedOut, setIsDeleteTimedOut] = useState(false)
  const [isDeleteTimeoutExhausted, setIsDeleteTimeoutExhausted] = useState(false)
  const deleteControllerRef = useRef<AbortController | null>(null)

  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  const sentenceSegments = useMemo(() => {
    if (!readingText) {
      return []
    }
    return splitContentIntoSentences(readingText.content)
  }, [readingText])

  const stopSpeaking = useCallback(() => {
    playbackSessionIdRef.current += 1

    if (!isSpeechSupported) {
      setIsSpeaking(false)
      setActiveSentenceIndex(null)
      return
    }

    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setActiveSentenceIndex(null)
  }, [isSpeechSupported])

  const startSpeakingFromSentence = useCallback((startIndex: number) => {
    if (!readingText || !isSpeechSupported || sentenceSegments.length === 0) {
      return
    }

    if (startIndex < 0 || startIndex >= sentenceSegments.length) {
      return
    }

    window.speechSynthesis.cancel()
    playbackSessionIdRef.current += 1
    const playbackSessionId = playbackSessionIdRef.current
    setIsSpeaking(true)

    const speakSentence = (sentenceIndex: number) => {
      if (playbackSessionId !== playbackSessionIdRef.current) {
        return
      }

      if (sentenceIndex >= sentenceSegments.length) {
        setIsSpeaking(false)
        setActiveSentenceIndex(null)
        return
      }

      const sentence = sentenceSegments[sentenceIndex]
      setActiveSentenceIndex(sentenceIndex)

      const utterance = new SpeechSynthesisUtterance(sentence.text)
      utterance.lang = 'zh-CN'

      utterance.onerror = () => {
        if (playbackSessionId !== playbackSessionIdRef.current) {
          return
        }
        setIsSpeaking(false)
        setActiveSentenceIndex(null)
      }

      utterance.onend = () => {
        if (playbackSessionId !== playbackSessionIdRef.current) {
          return
        }
        speakSentence(sentenceIndex + 1)
      }

      window.speechSynthesis.speak(utterance)
    }

    speakSentence(startIndex)
  }, [isSpeechSupported, readingText, sentenceSegments])

  const handleSpeakReadingText = useCallback(() => {
    startSpeakingFromSentence(0)
  }, [startSpeakingFromSentence])

  const registerSentenceRowRef = useCallback((index: number, node: HTMLButtonElement | null) => {
    if (!node) {
      sentenceRowRefs.current.delete(index)
      return
    }
    sentenceRowRefs.current.set(index, node)
  }, [])

  useEffect(() => {
    return () => {
      if (isSpeechSupported) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSpeechSupported])

  useEffect(() => {
    stopSpeaking()
    setShowPinyin(false)
    setSentencePinyinLines([])
    setIsPinyinLoading(false)
    sentenceRowRefs.current.clear()
  }, [readingText?.id, stopSpeaking])

  useEffect(() => {
    if (activeSentenceIndex == null) {
      return
    }

    const row = sentenceRowRefs.current.get(activeSentenceIndex)
    if (!row) {
      return
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSentenceIndex])

  useEffect(() => {
    if (!showPinyin || sentenceSegments.length === 0) {
      setSentencePinyinLines([])
      setIsPinyinLoading(false)
      return
    }

    let isCancelled = false
    setIsPinyinLoading(true)

    void buildSentencePinyinLines(sentenceSegments.map((segment) => segment.text))
      .then((lines) => {
        if (isCancelled) {
          return
        }
        setSentencePinyinLines(lines)
      })
      .catch(() => {
        if (isCancelled) {
          return
        }
        setSentencePinyinLines(sentenceSegments.map(() => PINYIN_UNAVAILABLE_FALLBACK))
      })
      .finally(() => {
        if (isCancelled) {
          return
        }
        setIsPinyinLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [showPinyin, sentenceSegments])

  const loadLibrary = useCallback(async () => {
    if (!isAuthenticated) {
      setTexts([])
      setIsLoading(false)
      return
    }

    const clearTimer = attachTimeout(setIsLoadingTimedOut, loadingControllerRef)
    setIsLoading(true)

    try {
      const libRes = await fetch(`${API_BASE_URL}/api/library`, {
        credentials: 'include',
        signal: loadingControllerRef.current?.signal,
      })
      if (!libRes.ok) { return }
      const payload = (await libRes.json()) as { texts?: SavedText[] }
      setTexts(payload.texts ?? [])
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsLoadingTimedOut(true)
        return
      }
    } finally {
      clearTimer()
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    void loadLibrary()
  }, [isAuthenticated, status, loadLibrary])

  const shelves = useMemo(() => {
    return HSK_LEVELS.map((level) => ({
      level,
      texts: texts.filter((t) => t.hsk_level === level),
    }))
  }, [texts])

  const handleOpen = (text: SavedText) => {
    setReadingText(text)
  }

  const handleOpenEdit = (text: SavedText) => {
    setEditingText(text)
    setEditTitle(text.title)
    setEditContent(text.content)
    setEditError(null)
  }

  const handleSaveEdit = async () => {
    if (!editingText) return
    const nextContent = editContent.trim()
    if (!nextContent) { setEditError('Content cannot be empty.'); return }

    setIsEditTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsEditTimedOut, editControllerRef)
    setIsSavingEdit(true)
    setEditError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/library/${editingText.id}/edit`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), content: nextContent }),
        signal: editControllerRef.current?.signal,
      })
      const payload = (await res.json()) as SavedText & { error?: string }
      if (!res.ok) {
        setEditError(typeof payload.error === 'string' ? payload.error : 'Failed to save.')
        return
      }
      setTexts((prev) => prev.map((t) => (t.id === payload.id ? payload : t)))
      setEditingText(null)
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsEditTimedOut(true)
        return
      }
      setEditError('Unexpected error while saving.')
    } finally {
      clearTimer()
      setIsSavingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingText) return
    setIsDeleteTimeoutExhausted(false)
    const clearTimer = attachTimeout(setIsDeleteTimedOut, deleteControllerRef)
    setIsDeleting(true)
    try {
      await fetch(`${API_BASE_URL}/api/library/${deletingText.id}`, {
        method: 'DELETE',
        credentials: 'include',
        signal: deleteControllerRef.current?.signal,
      })
      setTexts((prev) => prev.filter((t) => t.id !== deletingText.id))
      setDeletingText(null)
    } catch (error) {
      if (isAbortError(error)) return
      if (isBackendConnectionFailure(error)) {
        setIsDeleteTimedOut(true)
        return
      }
    } finally {
      clearTimer()
      setIsDeleting(false)
    }
  }

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
        <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mono text-xs uppercase tracking-[0.2em] text-[#8d7c6f]">Library</p>
              <h1 className="mt-2 text-3xl font-extrabold text-[#1b1714]">HSK Text Shelf</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#66594f]">
                Texts are grouped by the highest HSK level word they contain.
              </p>
            </div>
            <Link
              to="/paste"
              className="rounded-xl bg-[#d1451b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Add New Text
            </Link>
          </div>

          <div className="mt-8">
            {isLoading || isLoadingTimedOut ? (
              <LoadingCard
                busy={isLoadingTimedOut}
                message="Loading library…"
                showCountdown={false}
              />
            ) : !isAuthenticated ? (
              <div className="rounded-xl border border-dashed border-[#d8cab8] bg-[#fffdf9] p-8 text-center">
                <p className="text-sm font-semibold text-[#66594f]">
                  <Link to="/account?mode=login" className="text-[#d1451b] hover:underline">Sign in</Link> to view your saved texts.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {shelves.map(({ level, texts: shelfTexts }) => (
                  <article key={level} className="rounded-xl border border-[#e4d7c5] bg-[#fff8ef] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold text-[#2f261f]">HSK {level}</h2>
                      <span className="mono text-xs uppercase tracking-[0.15em] text-[#8f7f6f]">{shelfTexts.length} {shelfTexts.length === 1 ? 'Text' : 'Texts'}</span>
                    </div>

                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                      {shelfTexts.length === 0 ? (
                        <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-[#d8cab8] bg-[#fffdf9] px-6 text-center sm:h-36">
                          <p className="max-w-xl text-sm font-semibold leading-relaxed text-[#66594f]">
                            No texts saved at this level yet.
                          </p>
                        </div>
                      ) : (
                        shelfTexts.map((text) => (
                          <TextCard
                            key={text.id}
                            text={text}
                            onOpen={() => handleOpen(text)}
                            onEdit={() => handleOpenEdit(text)}
                            onDelete={() => setDeletingText(text)}
                          />
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Reading modal */}
      {readingText ? (
        <div className="library-modal-overlay fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/50 px-4 py-8">
          <div className="library-modal relative flex w-full max-w-2xl flex-col rounded-2xl border border-[#d8ccbd] bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
            {/* Close button */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                stopSpeaking()
                setReadingText(null)
              }}
              className="library-modal-close absolute right-4 top-4 rounded-md px-2 py-1 text-sm font-bold text-[#5b4f46] transition hover:bg-[#faf6f0]"
            >
              ✕
            </button>

            {/* Header */}
            <div className="border-b border-[#ede3d6] px-6 pt-5 pb-4 pr-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#8d7c6f]">HSK {readingText.hsk_level}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPinyin((current) => !current)}
                    disabled={sentenceSegments.length === 0}
                    className="library-modal-action-button rounded-md border border-[#d8ccbd] bg-white px-2 py-1 text-xs font-semibold text-[#3e342d] transition hover:bg-[#faf6f0] disabled:opacity-60"
                  >
                    {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking()
                        return
                      }
                      handleSpeakReadingText()
                    }}
                    disabled={!isSpeechSupported || sentenceSegments.length === 0}
                    className="library-modal-action-button inline-flex items-center gap-1 rounded-md border border-[#d8ccbd] bg-white px-2 py-1 text-xs font-semibold text-[#3e342d] transition hover:bg-[#faf6f0] disabled:opacity-60"
                    aria-label={isSpeaking ? 'Stop reading aloud' : 'Read aloud'}
                  >
                    <SpeakerIcon />
                    {isSpeaking ? 'Stop' : 'Speak'}
                  </button>
                </div>
              </div>
              <h2 className="mt-0.5 text-xl font-extrabold text-[#1b1714]">
                {readingText.title || readingText.content.slice(0, 60)}
              </h2>
              <p className="mt-0.5 text-xs text-[#a09080]">{new Date(readingText.created_at).toLocaleDateString()}</p>
              <p className="mt-2 text-xs font-semibold text-[#8f7f6f]">
                Click any sentence to read from there.
              </p>
              {showPinyin && isPinyinLoading ? (
                <p className="mt-2 text-xs font-semibold text-[#8f7f6f]">
                  Loading pinyin…
                </p>
              ) : null}
              {!isSpeechSupported ? (
                <p className="mt-2 text-xs font-semibold text-[#8f7f6f]">
                  Speech playback is not available in this browser.
                </p>
              ) : null}
            </div>

            {/* Scrollable body */}
            <div ref={sentenceBodyRef} className="overflow-y-auto px-6 py-5">
              <div className="space-y-2 text-base leading-loose text-[#2f261f]">
                {sentenceSegments.map((sentence, index) => (
                  <button
                    key={`${index}-${sentence.text.slice(0, 24)}`}
                    type="button"
                    ref={(node) => registerSentenceRowRef(index, node)}
                    onClick={() => startSpeakingFromSentence(index)}
                    disabled={!isSpeechSupported}
                    className={`library-modal-sentence-row block w-full rounded-md px-2 py-1 text-left transition ${
                      index === activeSentenceIndex
                        ? 'library-modal-sentence-row-active bg-[#ffe29f] text-[#1b1714]'
                        : 'hover:bg-[#faf6f0]'
                    } disabled:cursor-default disabled:hover:bg-transparent`}
                  >
                    <span className="block">{sentence.text}</span>
                    {showPinyin ? (
                      <span
                        className={`library-modal-pinyin-line mt-0.5 block text-xs font-semibold leading-relaxed text-[#6f5f53] ${
                          index === activeSentenceIndex ? 'library-modal-pinyin-line-active' : ''
                        }`}
                      >
                        {isPinyinLoading
                          ? PINYIN_LOADING_PLACEHOLDER
                          : sentencePinyinLines[index] || PINYIN_UNAVAILABLE_FALLBACK}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {editingText ? (
        <div className="library-modal-overlay fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="library-modal library-modal-compact relative w-full max-w-lg rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setEditingText(null)}
              className="library-modal-close absolute right-4 top-4 rounded-md px-2 py-1 text-sm font-bold text-[#5b4f46] transition hover:bg-[#faf6f0]"
            >
              ✕
            </button>
            <h2 className="text-xl font-extrabold text-[#1b1714]">Edit Text</h2>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7c6e62]">Title</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d8ccbd] bg-white px-3 py-2 text-sm text-[#1b1714] outline-none ring-[#d1451b]/25 transition focus:ring"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7c6e62]">Content</span>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-[#d8ccbd] bg-white px-3 py-2 text-sm text-[#1b1714] outline-none ring-[#d1451b]/25 transition focus:ring"
                />
              </label>
            </div>

            {editError ? <p className="mt-2 text-sm font-semibold text-[#b42020]">{editError}</p> : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || (isEditTimedOut && !isEditTimeoutExhausted)}
                className="library-modal-primary-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1451b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:opacity-60"
              >
                {isSavingEdit && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isSavingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingText(null)}
                className="library-modal-secondary-button rounded-xl border border-[#1b1714] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#faf6f0]"
              >
                Cancel
              </button>
            </div>
            <BusyRetryBanner
              active={isEditTimedOut}
              onExhausted={() => setIsEditTimeoutExhausted(true)}
            />
          </div>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {deletingText ? (
        <div className="library-modal-overlay fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="library-modal library-modal-compact relative w-full max-w-sm rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-[#1b1714]">Delete Text?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
              "{deletingText.title || deletingText.content.slice(0, 60)}" will be permanently removed from your library.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || (isDeleteTimedOut && !isDeleteTimeoutExhausted)}
                className="library-modal-danger-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#b42020] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#941c1c] disabled:opacity-60"
              >
                {isDeleting && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeletingText(null)}
                className="library-modal-secondary-button rounded-xl border border-[#1b1714] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#faf6f0]"
              >
                Cancel
              </button>
            </div>
            <BusyRetryBanner
              active={isDeleteTimedOut}
              onExhausted={() => setIsDeleteTimeoutExhausted(true)}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

