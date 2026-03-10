import { Link } from 'react-router-dom'

export function PastePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10">
      <Link to="/" className="mono text-xs uppercase tracking-[0.2em] text-[#7a6c60] hover:text-[#1b1714]">
        &larr; Back to landing
      </Link>

      <section className="mt-5 rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Paste Mandarin Passage</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Paste any Chinese text and Hanlearn will extract unknown vocabulary before you start reading.
        </p>

        <textarea
          rows={12}
          placeholder="Paste Mandarin text here..."
          className="mt-6 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-4 text-sm text-[#2d241d] outline-none ring-[#d1451b] placeholder:text-[#a28d79] focus:ring-2"
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/analyze"
            className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
          >
            Analyze Passage
          </Link>
          <Link
            to="/upload"
            className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
          >
            Switch to Upload Mode
          </Link>
        </div>
      </section>
    </main>
  )
}
