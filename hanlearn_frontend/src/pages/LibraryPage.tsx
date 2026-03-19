import { Link } from 'react-router-dom'

type PlaceholderText = {
  id: string
  name: string
}

type HskShelf = {
  level: string
  texts: PlaceholderText[]
}

const HSK_SHELVES: HskShelf[] = [
  { level: 'HSK 1', texts: [] },
  { level: 'HSK 2', texts: [] },
  { level: 'HSK 3', texts: [] },
  { level: 'HSK 4', texts: [] },
  { level: 'HSK 5', texts: [] },
  { level: 'HSK 6', texts: [] },
  { level: 'HSK 7', texts: [] },
  { level: 'HSK 8', texts: [] },
  { level: 'HSK 9', texts: [] },
]

export function LibraryPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <section className="rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.2em] text-[#8d7c6f]">Library</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#1b1714]">HSK Text Shelf</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#66594f]">
              Each row is an HSK level. Vertical cards represent saved texts. These are placeholder entries for now.
            </p>
          </div>
          <Link
            to="/paste"
            className="rounded-xl bg-[#d1451b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
          >
            Add New Text
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {HSK_SHELVES.map((shelf) => (
            <article key={shelf.level} className="rounded-xl border border-[#e4d7c5] bg-[#fff8ef] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#2f261f]">{shelf.level}</h2>
                <span className="mono text-xs uppercase tracking-[0.15em] text-[#8f7f6f]">{shelf.texts.length} Texts</span>
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {shelf.texts.length === 0 ? (
                  <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-[#d8cab8] bg-[#fffdf9] px-6 text-center sm:h-36">
                    <p className="max-w-xl text-sm font-semibold leading-relaxed text-[#66594f]">
                      Upload texts to the miner to fill shelves.
                    </p>
                  </div>
                ) : (
                  shelf.texts.map((text) => (
                    <div key={text.id} className="w-24 shrink-0 sm:w-28">
                      <button
                        type="button"
                        className="group flex w-full flex-col items-center"
                        aria-label={`Library text card for ${text.name}`}
                      >
                        <div className="h-32 w-full rounded-lg border border-[#d8cab8] bg-gradient-to-b from-[#fff9f0] via-[#f6e7d5] to-[#efd8bf] shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-36" />
                        <p className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-tight text-[#4a3e35]">
                          {text.name}
                        </p>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}