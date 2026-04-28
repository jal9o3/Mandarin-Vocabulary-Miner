/**
 * Attaches a 5-second timeout to a fetch operation.
 *
 * - Aborts any previous request tracked by controllerRef
 * - Creates a new AbortController stored in controllerRef
 * - Starts a timer; on expiry calls setTimedOut(true) so the UI
 *   can show a retry prompt — the in-flight request is NOT aborted
 * - Returns a clearTimer function to call in the finally block
 *
 * On retry: call the same operation function again; attachTimeout
 * will abort the old controller and create a fresh one.
 */
export function attachTimeout(
  setTimedOut: (v: boolean) => void,
  controllerRef: { current: AbortController | null },
  timeoutMs = 5000,
): () => void {
  controllerRef.current?.abort()
  controllerRef.current = new AbortController()
  setTimedOut(false)

  const id = window.setTimeout(() => setTimedOut(true), timeoutMs)
  return () => window.clearTimeout(id)
}
