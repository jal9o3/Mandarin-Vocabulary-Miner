import { Link } from 'react-router-dom'

export function UploadPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 sm:px-10">
      <Link to="/" className="mono text-xs uppercase tracking-[0.2em] text-[#7a6c60] hover:text-[#1b1714]">
        &larr; Back to landing
      </Link>

      <section className="mt-5 rounded-2xl border border-[#d6c7b6] bg-[var(--han-panel)] p-6 shadow-xl shadow-[#bf9f83]/15 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[#1b1714]">Upload Mandarin Text</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#66594f]">
          Upload a `.txt`, `.md`, or subtitle file to run a vocabulary coverage analysis against your word bank.
        </p>

        <label className="mt-6 block rounded-xl border border-dashed border-[#c9b39b] bg-[#fff8ee] p-8 text-center text-sm font-semibold text-[#7b654f]">
          Select file
          <input type="file" className="mt-4 block w-full cursor-pointer text-sm" accept=".txt,.md,.srt" />
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/analyze"
            className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
          >
            Analyze File
          </Link>
          <Link
            to="/paste"
            className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
          >
            Switch to Paste Mode
          </Link>
        </div>
      </section>
    </main>
  )
}
