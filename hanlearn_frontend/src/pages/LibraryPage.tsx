import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

type SavedText = {
  id: number
  title: string
  content: string
  hsk_level: number
  created_at: string
}

export function LibraryPage() {
  const navigate = useNavigate()
  const [texts, setTexts] = useState<SavedText[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
        if (!meRes.ok) { setIsLoading(false); return }
        const me = (await meRes.json()) as { is_authenticated?: boolean }
        if (!me.is_authenticated) { setIsLoading(false); return }
        setIsAuthenticated(true)

        const libRes = await fetch(`${API_BASE_URL}/api/library`, { credentials: 'include' })
        if (!libRes.ok) { setIsLoading(false); return }
        const payload = (await libRes.json()) as { texts?: SavedText[] }
        setTexts(payload.texts ?? [])
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const shelves = useMemo(() => {
    return HSK_LEVELS.map((level) => ({
      level,
      texts: texts.filter((t) => t.hsk_level === level),
    }))
  }, [texts])

  const handleOpen = (text: SavedText) => {
    navigate('/paste', { state: { prefillText: text.content } })
  }

  return (
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
                        <div key={text.id} className="w-28 shrink-0 sm:w-32">
                          <button
                            type="button"
                            onClick={() => handleOpen(text)}
                            className="group flex w-full flex-col items-center"
                            aria-label={`Open: ${text.title || text.content.slice(0, 40)}`}
                          >
                            <div className="flex h-32 w-full flex-col justify-end rounded-lg border border-[#d8cab8] bg-gradient-to-b from-[#fff9f0] via-[#f6e7d5] to-[#efd8bf] p-2 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-36">
                              <p className="line-clamp-4 text-[10px] leading-snug text-[#7a6355]">
                                {text.content}
                              </p>
                            </div>
                            <p className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-tight text-[#4a3e35] group-hover:text-[#d1451b]">
                              {text.title || text.content.slice(0, 40)}
                            </p>
                          </button>
                        </div>
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
  )
}