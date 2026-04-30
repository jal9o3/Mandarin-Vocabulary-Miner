export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export type PendingReviewUpload = {
  id: string
  username: string
  cardId: number
  rating: ReviewRating
  idempotencyKey: string
  attempts: number
  nextAttemptAt: number
  lastError: string | null
  createdAt: number
}

const STORAGE_KEY = 'hanlearn:review-upload-queue:v1'

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const safeParseQueue = (raw: string | null): PendingReviewUpload[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is PendingReviewUpload => (
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as PendingReviewUpload).id === 'string'
      && typeof (entry as PendingReviewUpload).username === 'string'
      && typeof (entry as PendingReviewUpload).cardId === 'number'
      && typeof (entry as PendingReviewUpload).rating === 'string'
      && typeof (entry as PendingReviewUpload).idempotencyKey === 'string'
      && typeof (entry as PendingReviewUpload).attempts === 'number'
      && typeof (entry as PendingReviewUpload).nextAttemptAt === 'number'
      && typeof (entry as PendingReviewUpload).createdAt === 'number'
    ))
  } catch {
    return []
  }
}

export const loadReviewUploadQueue = (): PendingReviewUpload[] => {
  return safeParseQueue(window.localStorage.getItem(STORAGE_KEY))
}

export const saveReviewUploadQueue = (jobs: PendingReviewUpload[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
}

export const enqueueReviewUpload = (
  username: string,
  cardId: number,
  rating: ReviewRating,
): PendingReviewUpload => {
  const now = Date.now()
  const next: PendingReviewUpload = {
    id: randomId(),
    username,
    cardId,
    rating,
    idempotencyKey: randomId(),
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
  }

  const queue = loadReviewUploadQueue()
  queue.push(next)
  saveReviewUploadQueue(queue)
  return next
}

export const replaceReviewUpload = (job: PendingReviewUpload) => {
  const queue = loadReviewUploadQueue()
  const nextQueue = queue.map((entry) => (entry.id === job.id ? job : entry))
  saveReviewUploadQueue(nextQueue)
}

export const removeReviewUpload = (jobId: string) => {
  const queue = loadReviewUploadQueue()
  const nextQueue = queue.filter((entry) => entry.id !== jobId)
  saveReviewUploadQueue(nextQueue)
}

export const removeReviewUploadsForUser = (username: string) => {
  const queue = loadReviewUploadQueue()
  const nextQueue = queue.filter((entry) => entry.username !== username)
  saveReviewUploadQueue(nextQueue)
}
