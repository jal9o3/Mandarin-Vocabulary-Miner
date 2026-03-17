type ScreeningWord = {
  word: string
  pinyin: string
  occurrences: number
}

type ScreeningGroup = {
  level: string
  words: ScreeningWord[]
}

type ScreeningPayload = {
  cleaned_text: string
  total_unique_words: number
  total_occurrences: number
  groups: ScreeningGroup[]
}

type Props = {
  screening: ScreeningPayload
  selectedWords: string[]
  onToggleWord: (word: string) => void
  onSelectGroup: (group: ScreeningGroup) => void
  onClearGroup: (group: ScreeningGroup) => void
}

export function HskWordSelector({ screening, selectedWords, onToggleWord, onSelectGroup, onClearGroup }: Props) {
  const selectedWordSet = new Set(selectedWords)
  const totalScreeningWords = screening.groups.reduce((sum, g) => sum + g.words.length, 0)

  return (
    <section className="mt-8 rounded-xl border border-[#e6dbc9] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1b1714]">Step 2: Select Known Words</h2>
          <p className="mt-1 text-sm text-[#66594f]">
            {screening.total_unique_words} unique words detected. Select the words you already know from each HSK band.
          </p>
        </div>
        <p className="rounded-full bg-[#fff1e5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#8c2f11]">
          Selected: {selectedWords.length}/{totalScreeningWords}
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        {screening.groups.map((group) => (
          <article key={group.level} className="rounded-lg border border-[#eddcc8] bg-[#fffaf2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[#2b211b]">{group.level}</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectGroup(group)}
                  className="rounded-full border border-[#d3b89e] bg-white px-3 py-1 text-xs font-semibold text-[#5d4a3a] transition hover:bg-[#fff3e8]"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onClearGroup(group)}
                  className="rounded-full border border-[#d3b89e] bg-white px-3 py-1 text-xs font-semibold text-[#5d4a3a] transition hover:bg-[#fff3e8]"
                >
                  Clear
                </button>
              </div>
            </div>

            {group.words.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {group.words.map((entry) => {
                  const checked = selectedWordSet.has(entry.word)
                  return (
                    <label
                      key={`${group.level}-${entry.word}`}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        checked
                          ? 'border-[#d1451b] bg-[#fff0e8] text-[#8c2f11]'
                          : 'border-[#d8ccbd] bg-white text-[#4e4138] hover:bg-[#fff7ef]'
                      }`}
                      title={`${entry.pinyin} | ${entry.occurrences} occurrences`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleWord(entry.word)}
                        className="h-3.5 w-3.5 rounded border-[#bba890] text-[#d1451b]"
                      />
                      <span>{entry.word}</span>
                      <span className="mono text-[10px] uppercase tracking-[0.1em] text-[#8d7c6f]">
                        {entry.occurrences}x
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#8d7c6f]">No words detected in this band.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
