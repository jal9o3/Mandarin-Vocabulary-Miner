import { Link } from 'react-router-dom'

const priorityWords = ['沉浸式', '词汇量', '表达能力', '流利度', '语感', '掌握']

export function AnalyzePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <Link to="/" className="mono text-xs uppercase tracking-[0.2em] text-[#7a6c60] hover:text-[#1b1714]">
        &larr; Back to landing
      </Link>

      <section className="mt-5 rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Vocabulary Coverage Report</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          This route is now wired for your real analysis output. The current values are placeholder data.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Coverage</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">82%</p>
          </div>
          <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Unknown words</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">14</p>
          </div>
          <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Suggested HSK target</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">HSK 4</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
          <h2 className="text-lg font-bold text-[#1b1714]">Priority drill set</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            {priorityWords.map((word) => (
              <span key={word} className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]">
                {word}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/upload"
            className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
          >
            Analyze Another File
          </Link>
          <Link
            to="/paste"
            className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
          >
            Analyze New Passage
          </Link>
        </div>
      </section>
    </main>
  )
}
