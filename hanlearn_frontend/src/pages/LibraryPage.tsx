import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type SavedText = {
  id: number
  title: string
  content: string
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

  const handleOpen = (text: SavedText) => {
    navigate('/paste', { state: { prefillText: text.content } })
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.2em] text-[#8d7c6f]">Library</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#1b1714]">Saved Texts</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#66594f]">
              Texts you've saved from the analyzer. Click a card to re-open it for analysis.
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
          ) : texts.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#d8cab8] bg-[#fffdf9] px-6 text-center">
              <p className="max-w-sm text-sm font-semibold leading-relaxed text-[#66594f]">
                No saved texts yet. Use the heart icon on the Analyze page to save a text here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {texts.map((text) => (
                <button
                  key={text.id}
                  type="button"
                  onClick={() => handleOpen(text)}
                  className="group rounded-xl border border-[#e4d7c5] bg-[#fff8ef] p-4 text-left transition hover:border-[#c4a882] hover:shadow-md"
                >
                  <p className="line-clamp-2 text-sm font-bold text-[#2f261f] group-hover:text-[#d1451b]">
                    {text.title || text.content.slice(0, 60)}
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#66594f]">
                    {text.content}
                  </p>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#a09080]">
                    {new Date(text.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}