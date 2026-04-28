/**
 * LoadingWithRetry — reusable loading + retry UI components.
 *
 * RetryPrompt: inline banner shown when a mutation times out
 * LoadingCard:  full-page centred spinner + optional retry UI
 */

type RetryPromptProps = {
  onRetry: () => void
  onCancel: () => void
}

export function RetryPrompt({ onRetry, onCancel }: RetryPromptProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#e9d4c8] bg-[#fff8f5] px-4 py-3 text-sm">
      <span className="text-[#7c5a4e]">This is taking longer than expected.</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-[#d1451b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b63e19]"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#d1451b] px-3 py-1.5 text-xs font-semibold text-[#d1451b] transition hover:bg-[#fff0ec]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

type LoadingCardProps = {
  timedOut: boolean
  onRetry: () => void
  onCancel: () => void
  message?: string
  className?: string
}

export function LoadingCard({
  timedOut,
  onRetry,
  onCancel,
  message = 'Loading…',
  className = 'h-64',
}: LoadingCardProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d1451b] border-t-transparent" />
      <p className="text-[#75695f]">{message}</p>
      {timedOut && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[#7c5a4e]">This is taking longer than expected.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-[#d1451b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b63e19]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#d1451b] px-4 py-2 text-sm font-semibold text-[#d1451b] transition hover:bg-[#fff0ec]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
