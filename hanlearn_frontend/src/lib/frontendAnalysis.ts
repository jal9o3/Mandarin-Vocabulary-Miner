type ScreeningWord = {
  word: string
  pinyin: string
  occurrences: number
}

type ScreeningGroup = {
  level: string
  words: ScreeningWord[]
}

export type ScreeningPayload = {
  cleaned_text: string
  total_unique_words: number
  total_occurrences: number
  groups: ScreeningGroup[]
}

export type PriorityInfo = {
  pronunciation: string
  meanings: string[]
}

type RankedWord = {
  word: string
  pinyin: string
  occurrences: number
  percentage: number
  is_known: boolean
}

export type AnalysisPayload = {
  cleaned_text: string
  known_percentage: number
  total_occurrences: number
  words: RankedWord[]
  unknown_words: string[]
  saved_flashcard_words: string[]
  priority_drill_set: Array<{
    word: string
    info: PriorityInfo
  }>
}

type WordlistEntry = {
  s?: unknown
  f?: unknown
}

type WordlistForm = {
  t?: unknown
  i?: unknown
  m?: unknown
}

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const ZH_PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~，。！？；：“”‘’（）【】《》   \n · 、 …"
const HAN_MATCH_REGEX = /\p{Script=Han}+/gu
const HAN_TOKEN_REGEX = /\p{Script=Han}/u
const NO_MEANING_FALLBACK = 'No meaning found in current wordlists.'
const NO_PRONUNCIATION_FALLBACK = '(pronunciation unavailable)'
export const PINYIN_UNAVAILABLE_FALLBACK = '(pinyin unavailable)'

type WordlistBundle = {
  hskLookup: Map<string, number>
  wordInfoLookup: Map<string, PriorityInfo>
}

let wordlistBundlePromise: Promise<WordlistBundle> | null = null
type CedictEntry = {
  pinyin: string
  english: string[]
}

type CedictResults = Record<string, CedictEntry[]> | CedictEntry[] | null

type CedictClient = {
  getBySimplified: (word: string, pinyin?: string | null, configOverrides?: Record<string, unknown>) => CedictResults
}

let cedictPromise: Promise<CedictClient | null> | null = null
const cedictWordCache = new Map<string, PriorityInfo | null>()
const DEFAULT_CEDICT_CDN_ENTRY = 'https://cdn.jsdelivr.net/npm/cc-cedict@1.1.1/dist/index.js'
const CEDICT_CDN_ENTRY = import.meta.env.VITE_CEDICT_CDN_ENTRY || DEFAULT_CEDICT_CDN_ENTRY

function debugLog(message: string, details?: unknown): void {
  if (!import.meta.env.DEV) {
    return
  }

  if (details === undefined) {
    console.debug(`[frontendAnalysis] ${message}`)
    return
  }

  console.debug(`[frontendAnalysis] ${message}`, details)
}

function removePunctuation(text: string): string {
  if (!text) {
    return ''
  }

  let result = ''
  for (const ch of text) {
    result += ZH_PUNCTUATION.includes(ch) ? ' ' : ch
  }
  return result
}

function normalizeToken(token: string): string {
  return token.trim()
}

function fallbackTokens(cleanedText: string): string[] {
  const chunks = cleanedText.match(HAN_MATCH_REGEX) ?? []
  const tokens: string[] = []
  for (const chunk of chunks) {
    for (const ch of chunk) {
      const normalized = normalizeToken(ch)
      if (normalized) {
        tokens.push(normalized)
      }
    }
  }
  return tokens
}

function segmentWithIntl(cleanedText: string): string[] {
  const SegmenterCtor = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (!SegmenterCtor) {
    return fallbackTokens(cleanedText)
  }

  const segmenter = new SegmenterCtor('zh', { granularity: 'word' })
  const segments = segmenter.segment(cleanedText)
  const tokens: string[] = []

  for (const segment of segments) {
    const token = normalizeToken(segment.segment)
    if (!token) {
      continue
    }
    if (!HAN_TOKEN_REGEX.test(token)) {
      continue
    }
    tokens.push(token)
  }

  return tokens.length ? tokens : fallbackTokens(cleanedText)
}

function tokenize(cleanedText: string): string[] {
  return segmentWithIntl(cleanedText)
}

function countWords(words: string[]): Map<string, number> {
  const counter = new Map<string, number>()
  for (const word of words) {
    counter.set(word, (counter.get(word) ?? 0) + 1)
  }
  return counter
}

function toSortedCounts(counter: Map<string, number>): Array<[string, number]> {
  return [...counter.entries()].sort((a, b) => b[1] - a[1])
}

function normalizeMeanings(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const seen = new Set<string>()
  const meanings: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue
    }
    const normalized = entry.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    meanings.push(normalized)
  }
  return meanings
}

function mergeMeanings(existing: string[], incoming: string[]): string[] {
  const merged = [...existing]
  const seen = new Set(existing)
  for (const meaning of incoming) {
    if (!meaning || seen.has(meaning)) {
      continue
    }
    seen.add(meaning)
    merged.push(meaning)
  }
  return merged
}

function upsertWordInfo(lookup: Map<string, PriorityInfo>, word: string, nextInfo: PriorityInfo): void {
  const normalizedWord = word.trim()
  if (!normalizedWord) {
    return
  }

  const existing = lookup.get(normalizedWord)
  if (!existing) {
    lookup.set(normalizedWord, nextInfo)
    return
  }

  lookup.set(normalizedWord, {
    pronunciation: existing.pronunciation || nextInfo.pronunciation,
    meanings: mergeMeanings(existing.meanings, nextInfo.meanings),
  })
}

function extractWords(entry: WordlistEntry): string[] {
  const words: string[] = []

  if (typeof entry.s === 'string' && entry.s.trim()) {
    words.push(entry.s.trim())
  }

  if (Array.isArray(entry.f)) {
    for (const form of entry.f) {
      if (!form || typeof form !== 'object') {
        continue
      }

      const candidate = (form as Record<string, unknown>).t
      if (typeof candidate === 'string' && candidate.trim()) {
        words.push(candidate.trim())
      }
    }
  }

  return words
}

function extractForms(entry: WordlistEntry): WordlistForm[] {
  if (!Array.isArray(entry.f)) {
    return []
  }

  return entry.f.filter((form): form is WordlistForm => !!form && typeof form === 'object')
}

function extractPinyinFromForm(form: WordlistForm): string {
  if (!form.i || typeof form.i !== 'object') {
    return ''
  }

  const pronunciation = (form.i as Record<string, unknown>).y
  return typeof pronunciation === 'string' ? pronunciation.trim() : ''
}

function buildPriorityInfoForWord(entry: WordlistEntry, word: string): PriorityInfo | null {
  const forms = extractForms(entry)
  let pronunciation = ''
  let meanings: string[] = []

  const matchingForms = forms.filter((form) => {
    const surface = typeof form.t === 'string' ? form.t.trim() : ''
    return surface === word
  })

  const candidateForms = matchingForms.length ? matchingForms : forms
  for (const form of candidateForms) {
    const nextPronunciation = extractPinyinFromForm(form)
    const nextMeanings = normalizeMeanings(form.m)
    if (!pronunciation && nextPronunciation) {
      pronunciation = nextPronunciation
    }
    meanings = mergeMeanings(meanings, nextMeanings)
  }

  if (!pronunciation && !meanings.length) {
    return null
  }

  return {
    pronunciation,
    meanings,
  }
}

function staticPath(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${relativePath}`
}

function fallbackStaticPath(relativePath: string): string {
  if (relativePath.startsWith('/')) {
    return relativePath
  }
  return `/${relativePath}`
}

async function loadLevelPayload(level: number): Promise<WordlistEntry[]> {
  const relativePath = `wordlists/inclusive/new/${level}.min.json`
  const candidateUrls = [staticPath(relativePath)]
  const fallbackPath = fallbackStaticPath(relativePath)

  if (fallbackPath !== candidateUrls[0]) {
    candidateUrls.push(fallbackPath)
  }

  for (const url of candidateUrls) {
    try {
      debugLog(`Loading wordlist level ${level} from ${url}`)
      const response = await fetch(url)
      if (!response.ok) {
        debugLog(`Wordlist level ${level} request failed`, { url, status: response.status })
        continue
      }

      const payload = (await response.json()) as unknown
      if (!Array.isArray(payload)) {
        debugLog(`Wordlist level ${level} payload was not an array`, { url })
        continue
      }

      const entries = payload.filter((entry): entry is WordlistEntry => !!entry && typeof entry === 'object')
      debugLog(`Wordlist level ${level} loaded`, { url, entries: entries.length })
      return entries
    } catch (error) {
      debugLog(`Wordlist level ${level} load threw`, { url, error })
    }
  }

  return []
}

async function loadWordlistBundle(): Promise<WordlistBundle> {
  const lookup = new Map<string, number>()
  const wordInfoLookup = new Map<string, PriorityInfo>()

  for (const level of HSK_LEVELS) {
    const payload = await loadLevelPayload(level)
    for (const entry of payload) {
      const words = extractWords(entry)
      for (const word of words) {
        const existing = lookup.get(word)
        if (existing === undefined || level < existing) {
          lookup.set(word, level)
        }

        const info = buildPriorityInfoForWord(entry, word)
        if (!info) {
          continue
        }

        upsertWordInfo(wordInfoLookup, word, info)
      }
    }
  }

  debugLog('Wordlist bundle loaded', {
    baseUrl: import.meta.env.BASE_URL || '/',
    hskLookupSize: lookup.size,
    wordInfoLookupSize: wordInfoLookup.size,
  })

  return {
    hskLookup: lookup,
    wordInfoLookup,
  }
}

async function getHskLookup(): Promise<Map<string, number>> {
  if (!wordlistBundlePromise) {
    wordlistBundlePromise = loadWordlistBundle()
  }

  try {
    const bundle = await wordlistBundlePromise
    return bundle.hskLookup
  } catch (error) {
    debugLog('getHskLookup failed; resetting bundle promise', { error })
    wordlistBundlePromise = null
    return new Map<string, number>()
  }
}

async function getWordInfoLookup(): Promise<Map<string, PriorityInfo>> {
  if (!wordlistBundlePromise) {
    wordlistBundlePromise = loadWordlistBundle()
  }

  try {
    const bundle = await wordlistBundlePromise
    return bundle.wordInfoLookup
  } catch (error) {
    debugLog('getWordInfoLookup failed; resetting bundle promise', { error })
    wordlistBundlePromise = null
    return new Map<string, PriorityInfo>()
  }
}

function estimateHskLevel(word: string, lookup: Map<string, number>): number {
  const exact = lookup.get(word)
  if (exact !== undefined) {
    return exact
  }

  if (word.length <= 1) {
    return 4
  }
  if (word.length === 2) {
    return 5
  }
  if (word.length === 3) {
    return 7
  }
  return 9
}

function buildFallbackPriorityInfo(word: string, wordInfoLookup: Map<string, PriorityInfo>): PriorityInfo {
  const parts: PriorityInfo[] = []
  for (const char of word) {
    const info = wordInfoLookup.get(char)
    if (info) {
      parts.push(info)
    }
  }

  if (parts.length) {
    const mergedMeanings = parts.reduce<string[]>((all, info) => mergeMeanings(all, info.meanings), [])
    const pronunciation = parts
      .map((info) => info.pronunciation.trim())
      .filter((value) => value.length > 0)
      .join(' ')

    return {
      pronunciation: pronunciation || NO_PRONUNCIATION_FALLBACK,
      meanings: mergedMeanings.length ? mergedMeanings : [NO_MEANING_FALLBACK],
    }
  }

  return {
    pronunciation: NO_PRONUNCIATION_FALLBACK,
    meanings: [NO_MEANING_FALLBACK],
  }
}

function resolvePriorityInfo(word: string, wordInfoLookup: Map<string, PriorityInfo>): PriorityInfo {
  const exact = wordInfoLookup.get(word)
  if (exact) {
    return {
      pronunciation: exact.pronunciation || NO_PRONUNCIATION_FALLBACK,
      meanings: exact.meanings.length ? exact.meanings : [NO_MEANING_FALLBACK],
    }
  }

  return buildFallbackPriorityInfo(word, wordInfoLookup)
}

function shouldUseCedictFallback(info: PriorityInfo): boolean {
  const hasMeaningFallbackOnly = info.meanings.length === 1 && info.meanings[0] === NO_MEANING_FALLBACK
  const hasNoPronunciation = info.pronunciation === NO_PRONUNCIATION_FALLBACK
  return hasMeaningFallbackOnly || hasNoPronunciation
}

function normalizeCedictResults(results: CedictResults): CedictEntry[] {
  if (!results) {
    return []
  }

  if (Array.isArray(results)) {
    return results
  }

  const entries: CedictEntry[] = []
  for (const group of Object.values(results)) {
    if (!Array.isArray(group)) {
      continue
    }

    for (const entry of group) {
      entries.push(entry)
    }
  }

  return entries
}

async function getCedictClient(): Promise<CedictClient | null> {
  if (!cedictPromise) {
    cedictPromise = import(/* @vite-ignore */ CEDICT_CDN_ENTRY)
      .then((module) => {
        const candidate = (module as { default?: unknown }).default
        if (!candidate || typeof candidate !== 'object') {
          return null
        }

        const maybeClient = candidate as Partial<CedictClient>
        if (typeof maybeClient.getBySimplified !== 'function') {
          return null
        }

        return maybeClient as CedictClient
      })
      .catch(() => null)
  }

  return cedictPromise
}

function lookupCedictInfo(word: string, cedict: CedictClient): PriorityInfo | null {
  const results = normalizeCedictResults(cedict.getBySimplified(word, null, { mergeCases: true, asObject: true }))
  if (!results.length) {
    return null
  }

  let pronunciation = ''
  let meanings: string[] = []

  for (const entry of results) {
    const nextPronunciation = entry.pinyin.trim()
    if (!pronunciation && nextPronunciation) {
      pronunciation = nextPronunciation
    }
    meanings = mergeMeanings(meanings, entry.english.map((meaning) => meaning.trim()).filter((meaning) => meaning.length > 0))
  }

  if (!pronunciation && !meanings.length) {
    return null
  }

  return {
    pronunciation,
    meanings,
  }
}

async function resolvePriorityInfoWithCedict(word: string, wordInfoLookup: Map<string, PriorityInfo>): Promise<PriorityInfo> {
  const localInfo = resolvePriorityInfo(word, wordInfoLookup)
  if (!shouldUseCedictFallback(localInfo)) {
    return localInfo
  }

  if (cedictWordCache.has(word)) {
    const cached = cedictWordCache.get(word)
    if (!cached) {
      return localInfo
    }

    return {
      pronunciation: cached.pronunciation || localInfo.pronunciation,
      meanings: cached.meanings.length ? cached.meanings : localInfo.meanings,
    }
  }

  const cedict = await getCedictClient()
  if (!cedict) {
    cedictWordCache.set(word, null)
    return localInfo
  }

  const cedictInfo = lookupCedictInfo(word, cedict)
  cedictWordCache.set(word, cedictInfo)

  if (!cedictInfo) {
    return localInfo
  }

  return {
    pronunciation: cedictInfo.pronunciation || localInfo.pronunciation,
    meanings: cedictInfo.meanings.length ? cedictInfo.meanings : localInfo.meanings,
  }
}

export async function buildVocabScreenFrontend(text: string): Promise<ScreeningPayload> {
  const cleaned_text = removePunctuation(text || '')
  const groupsMap = new Map<string, ScreeningWord[]>()
  for (const level of HSK_LEVELS) {
    groupsMap.set(`HSK ${level}`, [])
  }

  if (!cleaned_text.trim()) {
    return {
      cleaned_text,
      total_unique_words: 0,
      total_occurrences: 0,
      groups: [...groupsMap.entries()].map(([level, words]) => ({ level, words })),
    }
  }

  const lookup = await getHskLookup()
  const wordInfoLookup = await getWordInfoLookup()
  const words = tokenize(cleaned_text)
  const counter = countWords(words)

  for (const [word, occurrences] of toSortedCounts(counter)) {
    const level = estimateHskLevel(word, lookup)
    const key = `HSK ${level}`
    const bucket = groupsMap.get(key)
    if (!bucket) {
      continue
    }
    const info = wordInfoLookup.get(word)
    bucket.push({ word, pinyin: info?.pronunciation ?? '', occurrences })
  }

  return {
    cleaned_text,
    total_unique_words: counter.size,
    total_occurrences: words.length,
    groups: [...groupsMap.entries()].map(([level, groupedWords]) => ({ level, words: groupedWords })),
  }
}

export async function analyzeTextFrontend(text: string, selectedWords: string[], savedWords?: string[]): Promise<AnalysisPayload> {
  const cleaned_text = removePunctuation(text || '')
  const savedSet = new Set((savedWords ?? []).map((word) => word.trim()).filter((word) => word.length > 0))

  if (!cleaned_text.trim()) {
    return {
      cleaned_text,
      known_percentage: 0,
      total_occurrences: 0,
      words: [],
      unknown_words: [],
      saved_flashcard_words: [...savedSet].sort(),
      priority_drill_set: [],
    }
  }

  const words = tokenize(cleaned_text)
  const wordInfoLookup = await getWordInfoLookup()
  const counter = countWords(words)
  const rankedWords: RankedWord[] = []
  const vocabSet = new Set(selectedWords.map((word) => word.trim()).filter((word) => word.length > 0))
  const totalOccurrences = words.length

  let knownPercentage = 0
  for (const [word, occurrences] of toSortedCounts(counter)) {
    const percentage = totalOccurrences > 0 ? (occurrences / totalOccurrences) * 100 : 0
    const isKnown = vocabSet.has(word)
    if (isKnown) {
      knownPercentage += percentage
    }

    rankedWords.push({
      word,
      pinyin: wordInfoLookup.get(word)?.pronunciation ?? '',
      occurrences,
      percentage,
      is_known: isKnown,
    })
  }

  const unknown_words = rankedWords.filter((row) => !row.is_known).map((row) => row.word)
  const priorityCandidates = rankedWords
    .filter((row) => !row.is_known && !savedSet.has(row.word))
    .slice(0, 12)

  const priority_drill_set = await Promise.all(priorityCandidates.map(async (row) => ({
    word: row.word,
    info: await resolvePriorityInfoWithCedict(row.word, wordInfoLookup),
  })))

  return {
    cleaned_text,
    known_percentage: knownPercentage,
    total_occurrences: totalOccurrences,
    words: rankedWords,
    unknown_words,
    saved_flashcard_words: [...savedSet].sort(),
    priority_drill_set,
  }
}

export async function buildSentencePinyinLines(sentences: string[]): Promise<string[]> {
  const wordInfoLookup = await getWordInfoLookup()
  if (wordInfoLookup.size === 0) {
    debugLog('buildSentencePinyinLines running with empty wordInfoLookup')
  }

  const normalizePronunciation = (value: string | null | undefined): string | null => {
    if (!value) {
      return null
    }
    const trimmed = value.trim()
    if (!trimmed || trimmed === NO_PRONUNCIATION_FALLBACK) {
      return null
    }
    return trimmed
  }

  const resolveTokenPinyin = async (token: string): Promise<string> => {
    const localExact = normalizePronunciation(wordInfoLookup.get(token)?.pronunciation)
    if (localExact) {
      return localExact
    }

    try {
      const localFallback = resolvePriorityInfo(token, wordInfoLookup)
      const localFallbackPronunciation = normalizePronunciation(localFallback.pronunciation)
      if (localFallbackPronunciation) {
        return localFallbackPronunciation
      }
    } catch {
      // Keep token-level failures isolated so other tokens/sentences still resolve.
    }

    try {
      const cedictFallback = await resolvePriorityInfoWithCedict(token, wordInfoLookup)
      const cedictPronunciation = normalizePronunciation(cedictFallback.pronunciation)
      if (cedictPronunciation) {
        return cedictPronunciation
      }
    } catch {
      // Cedict fallback is optional; unresolved tokens still produce a stable placeholder.
    }

    return PINYIN_UNAVAILABLE_FALLBACK
  }

  return Promise.all(sentences.map(async (sentence) => {
    const tokens = tokenize(sentence)
    if (!tokens.length) {
      return ''
    }

    const tokenCache = new Map<string, string>()
    const parts = await Promise.all(tokens.map(async (token) => {
      const normalizedToken = token.trim()
      if (!normalizedToken) {
        return PINYIN_UNAVAILABLE_FALLBACK
      }

      const cached = tokenCache.get(normalizedToken)
      if (cached) {
        return cached
      }

      const resolved = await resolveTokenPinyin(normalizedToken)
      tokenCache.set(normalizedToken, resolved)
      return resolved
    }))

    const unresolvedCount = parts.filter((part) => part === PINYIN_UNAVAILABLE_FALLBACK).length
    if (unresolvedCount > 0) {
      debugLog('Sentence pinyin unresolved tokens', {
        sentencePreview: sentence.slice(0, 50),
        tokens: tokens.length,
        unresolvedCount,
      })
    }

    return parts.join(' ')
  }))
}
