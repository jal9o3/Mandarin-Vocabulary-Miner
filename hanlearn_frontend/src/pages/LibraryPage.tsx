import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/apiBase'
import { useAuth } from '../lib/auth'

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

type SavedText = {
  id: number
  title: string
  content: string
  hsk_level: number
  created_at: string
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
    <div className="w-28 shrink-0 sm:w-32">
      <div className="relative">
        {/* Book spine card */}
        <button
          type="button"
          onClick={onOpen}
          className="group flex w-full flex-col items-center"
          aria-label={`Open: ${text.title || text.content.slice(0, 40)}`}
        >
          <div className="flex h-32 w-full flex-col justify-end rounded-lg border border-[#d8cab8] bg-gradient-to-b from-[#fff9f0] via-[#f6e7d5] to-[#efd8bf] p-2 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-36">
            <p className="line-clamp-4 text-[10px] leading-snug text-[#7a6355]">
              {text.content}
            </p>
          </div>
        </button>

        {/* Three-dot menu button */}
        <div ref={menuRef} className="absolute right-1 top-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            aria-label="Options"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/70 text-[#5e5349] opacity-0 transition hover:bg-white hover:text-[#1b1714] group-scope-hover:opacity-100 [.w-28:hover_&]:opacity-100 [.w-32:hover_&]:opacity-100"
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

      <p className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-tight text-[#4a3e35]">
        {text.title || text.content.slice(0, 40)}
      </p>
    </div>
  )
}

export function LibraryPage() {
  const { isAuthenticated, status } = useAuth()
  const [texts, setTexts] = useState<SavedText[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Reading modal state
  const [readingText, setReadingText] = useState<SavedText | null>(null)

  // Edit modal state
  const [editingText, setEditingText] = useState<SavedText | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation state
  const [deletingText, setDeletingText] = useState<SavedText | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (!isAuthenticated) {
      setTexts([])
      setIsLoading(false)
      return
    }

    const load = async () => {
      setIsLoading(true)

      try {
        const libRes = await fetch(`${API_BASE_URL}/api/library`, { credentials: 'include' })
        if (!libRes.ok) { setIsLoading(false); return }
        const payload = (await libRes.json()) as { texts?: SavedText[] }
        setTexts(payload.texts ?? [])
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [isAuthenticated, status])

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

    setIsSavingEdit(true)
    setEditError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/library/${editingText.id}/edit`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), content: nextContent }),
      })
      const payload = (await res.json()) as SavedText & { error?: string }
      if (!res.ok) {
        setEditError(typeof payload.error === 'string' ? payload.error : 'Failed to save.')
        return
      }
      setTexts((prev) => prev.map((t) => (t.id === payload.id ? payload : t)))
      setEditingText(null)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingText) return
    setIsDeleting(true)
    try {
      await fetch(`${API_BASE_URL}/api/library/${deletingText.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setTexts((prev) => prev.filter((t) => t.id !== deletingText.id))
      setDeletingText(null)
    } finally {
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
            {isLoading ? (
              <p className="text-sm text-[#8d7c6f]">Loading…</p>
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
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/50 px-4 py-8">
          <div className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-[#d8ccbd] bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
            {/* Close button */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setReadingText(null)}
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-sm font-bold text-[#5b4f46] transition hover:bg-[#faf6f0]"
            >
              ✕
            </button>

            {/* Header */}
            <div className="border-b border-[#ede3d6] px-6 pt-5 pb-4 pr-12">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#8d7c6f]">HSK {readingText.hsk_level}</span>
              <h2 className="mt-0.5 text-xl font-extrabold text-[#1b1714]">
                {readingText.title || readingText.content.slice(0, 60)}
              </h2>
              <p className="mt-0.5 text-xs text-[#a09080]">{new Date(readingText.created_at).toLocaleDateString()}</p>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5">
              <p className="whitespace-pre-wrap text-base leading-loose text-[#2f261f]">
                {readingText.content}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {editingText ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setEditingText(null)}
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-sm font-bold text-[#5b4f46] transition hover:bg-[#faf6f0]"
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
                disabled={isSavingEdit}
                className="rounded-xl bg-[#d1451b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:opacity-60"
              >
                {isSavingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingText(null)}
                className="rounded-xl border border-[#1b1714] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#faf6f0]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {deletingText ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1714]/45 px-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-[#d8ccbd] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-[#1b1714]">Delete Text?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
              "{deletingText.title || deletingText.content.slice(0, 60)}" will be permanently removed from your library.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-[#b42020] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#941c1c] disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeletingText(null)}
                className="rounded-xl border border-[#1b1714] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#faf6f0]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

