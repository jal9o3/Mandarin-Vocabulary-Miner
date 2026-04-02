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
              Paste text. Hanlearn compares every word against your personal vocabulary bank,
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Readability estimate</p>
                    <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">82.0%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Unknown words</p>
                    <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">14</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#eadfce] bg-white p-4">
                <p className="text-sm font-semibold text-[#4c423a]">New extracted words</p>
                <div className="mt-3 grid gap-2">
                  <article className="rounded-lg border border-[#f0e3d5] bg-[#fffbf4] p-3">
                    <p className="text-sm font-bold text-[#8c2f11]">沉浸式</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[#8d7c6f]">Pronunciation</p>
                    <p className="mt-1 text-sm text-[#4b3f36]">chen jin shi</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[#8d7c6f]">Meanings</p>
                    <p className="mt-1 text-sm text-[#4b3f36]">immersive; deeply engaged</p>
                  </article>
                  <article className="rounded-lg border border-[#f0e3d5] bg-[#fffbf4] p-3">
                    <p className="text-sm font-bold text-[#8c2f11]">表达能力</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[#8d7c6f]">Pronunciation</p>
                    <p className="mt-1 text-sm text-[#4b3f36]">biao da neng li</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[#8d7c6f]">Meanings</p>
                    <p className="mt-1 text-sm text-[#4b3f36]">ability to express oneself</p>
                  </article>
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
            {/* <p className="mono text-xs uppercase tracking-[0.22em] text-[#996f4f]">Concept space</p> */}
            <h2 className="mt-2 text-2xl font-extrabold text-[#2d2118]">What is comprehensible input?</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#644f3f]">
              The sweet spot for language acquisition is input you almost understand — where roughly 95% of words are familiar. This is where your brain naturally absorbs new grammar and vocabulary through meaning-making, not memorization. Reading becomes effortless only when the unknown elements are few enough to infer from context. This is how input becomes truly comprehensible and learning accelerates.
            </p>
          </article>
          
          <article className="rounded-2xl border border-dashed border-[#c9b39b] bg-[#fff4e8] p-7">
            {/* <p className="mono text-xs uppercase tracking-[0.22em] text-[#996f4f]">Concept space</p> */}
            <h2 className="mt-2 text-2xl font-extrabold text-[#2d2118]">Skip the graded readers</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#644f3f]">
              Stop drilling through simplified children's stories. Real learning happens when you read what actually interests you—news articles, blogs, novels at your target level. Hanlearn bridges the gap: pick any advanced text you want to read, then drill exactly the words blocking comprehension. Now that advanced book becomes your comprehensible input, not a distant dream.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}
