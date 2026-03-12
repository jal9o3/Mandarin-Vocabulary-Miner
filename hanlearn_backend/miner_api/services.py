import string
from collections import Counter
from math import log10
from pathlib import Path

import jieba
from pypinyin import Style, pinyin


ZH_PUNCTUATION = string.punctuation + "，。！？；：“”‘’（）【】《》   \n · 、 …"


def remove_punctuation(text: str) -> str:
    return text.translate(str.maketrans("", "", ZH_PUNCTUATION))


def _word_to_pinyin(word: str) -> str:
    pinyin_parts = pinyin(word, style=Style.TONE3)
    return " ".join(part[0] for part in pinyin_parts if part)


def parse_vocab_text(vocab_text: str) -> list[str]:
    return [word for word in vocab_text.split() if word]


def load_vocab(vocab_file: Path) -> str:
    if not vocab_file.exists():
        vocab_file.touch()
        return ""
    return vocab_file.read_text(encoding="utf-8")


def save_vocab(vocab_file: Path, vocab_text: str) -> None:
    vocab_file.write_text(vocab_text, encoding="utf-8")


def _estimate_hsk_level(word: str) -> int:
    """Estimate an HSK-like band from jieba dictionary frequency."""
    frequency = int(jieba.dt.FREQ.get(word, 0) or 0)

    # Fall back to per-character frequency when a full token is missing.
    if frequency == 0 and len(word) > 1:
        frequency = max((int(jieba.dt.FREQ.get(char, 0) or 0) for char in word), default=0)

    score = log10(frequency + 1)
    if score >= 4.5:
        level = 1
    elif score >= 4.0:
        level = 2
    elif score >= 3.5:
        level = 3
    elif score >= 3.0:
        level = 4
    elif score >= 2.5:
        level = 5
    elif score >= 2.0:
        level = 6
    elif score >= 1.5:
        level = 7
    elif score >= 1.0:
        level = 8
    else:
        level = 9

    # Longer words tend to be introduced later in learning progression.
    if len(word) >= 3:
        level = min(9, level + 1)

    return level


def build_vocab_screen(text: str) -> dict:
    cleaned_text = remove_punctuation(text or "")
    groups = {f"HSK {level}": [] for level in range(1, 10)}

    if not cleaned_text.strip():
        return {
            "cleaned_text": cleaned_text,
            "total_unique_words": 0,
            "total_occurrences": 0,
            "groups": [{"level": level, "words": words} for level, words in groups.items()],
        }

    words = [word for word in jieba.cut(cleaned_text) if word.strip()]
    word_counter = Counter(words)

    for word, count in word_counter.most_common():
        level = f"HSK {_estimate_hsk_level(word)}"
        groups[level].append(
            {
                "word": word,
                "pinyin": _word_to_pinyin(word),
                "occurrences": count,
            }
        )

    return {
        "cleaned_text": cleaned_text,
        "total_unique_words": len(word_counter),
        "total_occurrences": sum(word_counter.values()),
        "groups": [{"level": level, "words": words} for level, words in groups.items()],
    }


def analyze_text(text: str, vocab_text: str) -> dict:
    cleaned_text = remove_punctuation(text or "")
    if not cleaned_text.strip():
        return {
            "cleaned_text": cleaned_text,
            "known_percentage": 0.0,
            "total_occurrences": 0,
            "words": [],
            "unknown_words": [],
        }

    words = list(jieba.cut(cleaned_text))
    word_counter = Counter(words)
    total_occurrences = sum(word_counter.values())
    vocab_list = parse_vocab_text(vocab_text)
    vocab_set = set(vocab_list)

    known_percentage = 0.0
    ranked_words = []
    for word, count in word_counter.most_common():
        pct = (count / total_occurrences) * 100
        is_known = word in vocab_set
        if is_known:
            known_percentage += pct
        ranked_words.append(
            {
                "word": word,
                "pinyin": _word_to_pinyin(word),
                "occurrences": count,
                "percentage": pct,
                "is_known": is_known,
            }
        )

    unknown_words = [row["word"] for row in ranked_words if not row["is_known"]]

    return {
        "cleaned_text": cleaned_text,
        "known_percentage": known_percentage,
        "total_occurrences": total_occurrences,
        "words": ranked_words,
        "unknown_words": unknown_words,
    }
