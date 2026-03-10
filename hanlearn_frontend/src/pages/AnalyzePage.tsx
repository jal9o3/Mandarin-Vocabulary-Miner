import { Link, useLocation } from 'react-router-dom'


type RankedWord = {
  word: string
  pinyin: string
  occurrences: number
  percentage: number
  is_known: boolean
}

type AnalysisPayload = {
  cleaned_text: string
  known_percentage: number
  total_occurrences: number
  words: RankedWord[]
  unknown_words: string[]
}

type AnalyzeLocationState = {
  analysis?: AnalysisPayload
  sourceText?: string
}

export function AnalyzePage() {
  const location = useLocation()
  const state = (location.state as AnalyzeLocationState | null) ?? null
  const analysis = state?.analysis

  if (!analysis) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
        <Link to="/" className="mono text-xs uppercase tracking-[0.2em] text-[#7a6c60] hover:text-[#1b1714]">
          &larr; Back to landing
        </Link>

        <section className="mt-5 rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
          <h1 className="text-3xl font-extrabold text-[#1b1714]">Vocabulary Coverage Report</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#66594f]">
            No analysis is loaded yet. Paste text first so Hanlearn can generate your report.
          </p>
          <div className="mt-6">
            <Link
              to="/paste"
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Go to Paste Mode
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const unknownCount = analysis.unknown_words.length
  const suggestedHsk =
    analysis.known_percentage >= 95
      ? 'HSK 6'
      : analysis.known_percentage >= 85
        ? 'HSK 5'
        : analysis.known_percentage >= 70
          ? 'HSK 4'
          : analysis.known_percentage >= 55
            ? 'HSK 3'
            : 'HSK 2'
  const topUnknownWords = analysis.words.filter((row) => !row.is_known).slice(0, 12)

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <Link to="/" className="mono text-xs uppercase tracking-[0.2em] text-[#7a6c60] hover:text-[#1b1714]">
        &larr; Back to landing
      </Link>

      <section className="mt-5 rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Vocabulary Coverage Report</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Based on your pasted passage, these are the words you likely still need to learn.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Coverage</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{analysis.known_percentage.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Unknown words</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{unknownCount}</p>
          </div>
          <div className="rounded-xl border border-[#e6dbc9] bg-[#fff8ee] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8d7c6f]">Suggested HSK target</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1b1714]">{suggestedHsk}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
          <h2 className="text-lg font-bold text-[#1b1714]">Priority drill set</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            {topUnknownWords.map((row) => (
              <span
                key={`${row.word}-${row.occurrences}`}
                className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]"
                title={`${row.pinyin} | ${row.occurrences} occurrences`}
              >
                {row.word}
              </span>
            ))}
            {!topUnknownWords.length ? (
              <span className="rounded-full bg-[var(--han-accent-soft)] px-3 py-1 text-[#8c2f11]">
                Great job, no unknown words found
              </span>
            ) : null}
          </div>
        </div>

        {state?.sourceText ? (
          <div className="mt-6 rounded-xl border border-[#e6dbc9] bg-white p-5">
            <h2 className="text-lg font-bold text-[#1b1714]">Analyzed passage</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#4b3f36]">{state.sourceText}</p>
          </div>
        ) : null}

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
