import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function PastePage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedText = text.trim()
    if (!trimmedText) {
      setErrorMessage('Please paste Mandarin text before analyzing.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedText }),
      })

      const payload = (await response.json()) as Record<string, unknown>
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : 'Failed to analyze passage.'
        throw new Error(error)
      }

      navigate('/analyze', {
        state: {
          analysis: payload,
          sourceText: trimmedText,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while analyzing text.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

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

        <form onSubmit={handleSubmit}>
          <textarea
            rows={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste Mandarin text here..."
            className="mt-6 w-full rounded-xl border border-[#d8ccbd] bg-[#fffdf8] p-4 text-sm text-[#2d241d] outline-none ring-[#d1451b] placeholder:text-[#a28d79] focus:ring-2"
          />

          {errorMessage ? <p className="mt-3 text-sm font-semibold text-[#b42020]">{errorMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#d1451b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b63e19] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Analyzing...' : 'Analyze Passage'}
            </button>
            <Link
              to="/upload"
              className="rounded-xl border border-[#1b1714] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:bg-white"
            >
              Switch to Upload Mode
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}
