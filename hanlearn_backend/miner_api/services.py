import string
from collections import Counter
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
