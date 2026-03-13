import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#f6aa72]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-80 h-72 w-72 rounded-full bg-[#d1451b]/20 blur-3xl" />

      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 pb-16 pt-10 sm:px-10 lg:px-12">
        <section className="mt-2 grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-6">
            <p className="mono reveal inline-block rounded-full border border-[#d6c7b6] bg-white/70 px-4 py-1 text-xs uppercase tracking-[0.2em] text-[#7a6c60]">
              Read harder texts, sooner
            </p>
            <h1 className="reveal delay-1 text-4xl font-extrabold leading-tight text-[#1b1714] sm:text-5xl lg:text-6xl">
              Turn any Mandarin passage into a focused drill plan.
            </h1>
            <p className="reveal delay-2 max-w-2xl text-lg leading-relaxed text-[#5e5349]">
              Paste text or upload a document. Hanlearn compares every word against your personal vocabulary bank,
              then pinpoints exactly what needs review before the passage becomes genuinely comprehensible.
            </p>

            <div className="reveal delay-3 flex flex-wrap gap-3">
              <Link
                to="/paste"
                className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#d1451b]/20 transition hover:-translate-y-0.5 hover:bg-[#b63e19]"
              >
                Try it now
              </Link>
              {/* <Link
                to="/paste"
                className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white"
              >
                Paste Text
              </Link> */}
            </div>
          </div>

          <aside className="reveal delay-2 rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-5 shadow-xl shadow-[#bf9f83]/20">
            <p className="mono text-xs uppercase tracking-[0.22em] text-[#8a7a6a]">Sample analysis</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#eadfce] bg-[#fffbf4] p-4">
                <p className="text-sm font-semibold text-[#4c423a]">Coverage score</p>
                <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">82%</p>
                <p className="text-sm text-[#75695f]">14 words to drill before this article feels smooth.</p>
              </div>
              <div className="rounded-xl border border-[#eadfce] bg-white p-4">
                <p className="text-sm font-semibold text-[#4c423a]">Unknown highlights</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]">沉浸式</span>
                  <span className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]">词汇量</span>
                  <span className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]">表达能力</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-[#d8ccbd] bg-white/80 p-6">
            <h2 className="text-lg font-bold text-[#1b1714]">1. Import your text</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65594f]">
              Drop in a reading passage, transcript, or subtitle file. Hanlearn tokenizes it into trackable words.
            </p>
          </article>
          <article className="rounded-2xl border border-[#d8ccbd] bg-white/80 p-6">
            <h2 className="text-lg font-bold text-[#1b1714]">2. Compare with your bank</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65594f]">
              Every item is matched against what you already know to reveal your true comprehension gap.
            </p>
          </article>
          <article className="rounded-2xl border border-[#d8ccbd] bg-white/80 p-6">
            <h2 className="text-lg font-bold text-[#1b1714]">3. Drill only what matters</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65594f]">
              Build a pre-reading set focused on high-impact unknown words, not random flashcards.
            </p>
          </article>
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-dashed border-[#c9b39b] bg-[#fff4e8] p-7">
            <p className="mono text-xs uppercase tracking-[0.22em] text-[#996f4f]">Concept space</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2d2118]">HSK level guidance</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#644f3f]">
              Reserve this section for explaining how Hanlearn maps unknown words to HSK bands (for example, HSK 3,
              HSK 4, and beyond), and how learners can prioritize drills by exam-relevant difficulty.
            </p>
          </article>

          <article className="rounded-2xl border border-dashed border-[#c9b39b] bg-[#fff4e8] p-7">
            <p className="mono text-xs uppercase tracking-[0.22em] text-[#996f4f]">Concept space</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#2d2118]">Comprehensible input logic</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#644f3f]">
              Reserve this section to explain why Hanlearn targets near-level texts, how much known vocabulary supports
              fluent reading, and what comprehension threshold unlocks effective input-driven acquisition.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}
