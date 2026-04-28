/**
 * LoadingWithRetry — reusable loading + auto-retry busy UI components.
 *
 * BusyRetryBanner: inline banner shown while auto retry countdown runs
 * LoadingCard:      full-page centred spinner + optional busy countdown
 */
import { useEffect, useState } from 'react'

function useRetryCountdown(active: boolean, onExhausted?: () => void) {
  const [secondsRemaining, setSecondsRemaining] = useState(60)
  const [isExhausted, setIsExhausted] = useState(false)

  useEffect(() => {
    if (!active) {
      setSecondsRemaining(60)
      setIsExhausted(false)
      return
    }

    setSecondsRemaining(60)
    setIsExhausted(false)
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
      const next = Math.max(60 - elapsedSeconds, 0)
      setSecondsRemaining(next)
      if (next === 0) {
        window.clearInterval(tick)
        setIsExhausted(true)
        onExhausted?.()
      }
    }, 250)

    return () => {
      window.clearInterval(tick)
    }
  }, [active, onExhausted])

  return { secondsRemaining, isExhausted }
}

type BusyRetryBannerProps = {
  active: boolean
  onExhausted?: () => void
}

export function BusyRetryBanner({ active, onExhausted }: BusyRetryBannerProps) {
  const { secondsRemaining, isExhausted } = useRetryCountdown(active, onExhausted)

  if (!active) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#e9d4c8] bg-[#fff8f5] px-4 py-3 text-sm">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#d1451b] border-t-transparent" />
      {isExhausted ? (
        <span className="text-[#7c5a4e]">Server unable to respond. Please try again later.</span>
      ) : (
        <span className="text-[#7c5a4e]">Server is busy. Retrying in {secondsRemaining} seconds...</span>
      )}
    </div>
  )
}

type LoadingCardProps = {
  busy: boolean
  onExhausted?: () => void
  message?: string
  className?: string
}

export function LoadingCard({
  busy,
  onExhausted,
  message = 'Loading…',
  className = 'h-64',
}: LoadingCardProps) {
  const { secondsRemaining, isExhausted } = useRetryCountdown(busy, onExhausted)

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d1451b] border-t-transparent" />
      <p className="text-[#75695f]">{message}</p>
      {busy ? (
        <p className="text-sm text-[#7c5a4e]">
          {isExhausted
            ? 'Server unable to respond. Please try again later.'
            : `Server is busy. Retrying in ${secondsRemaining} seconds...`}
        </p>
      ) : null}
    </div>
  )
}
