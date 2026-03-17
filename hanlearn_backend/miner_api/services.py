import json
import logging
import string
from collections import Counter
from functools import lru_cache
from math import log10
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import jieba
from pypinyin import Style, pinyin


ZH_PUNCTUATION = string.punctuation + "，。！？；：“”‘’（）【】《》   \n · 、 …"
HSK_LEVELS = tuple(range(1, 10))
WORDLISTS_DIR = Path(__file__).resolve().parents[1] / "wordlists" / "inclusive" / "new"
HSK_WORDLIST_URL = (
    "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/"
    "main/wordlists/inclusive/new/{level}.min.json"
)

logger = logging.getLogger(__name__)


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


def _fallback_hsk_level(word: str) -> int:
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


def _extract_entry_words(entry: dict) -> set[str]:
    words: set[str] = set()

    simplified = entry.get("s")
    if isinstance(simplified, str) and simplified.strip():
        words.add(simplified.strip())

    forms = entry.get("f")
    if isinstance(forms, list):
        for form in forms:
            if not isinstance(form, dict):
                continue
            surface = form.get("t")
            if isinstance(surface, str) and surface.strip():
                words.add(surface.strip())

    return words


def _find_form_for_word(entry: dict, word: str) -> dict | None:
    forms = entry.get("f")
    if not isinstance(forms, list):
        return None

    for form in forms:
        if not isinstance(form, dict):
            continue
        surface = form.get("t")
        if isinstance(surface, str) and surface.strip() == word:
            return form

    for form in forms:
        if isinstance(form, dict):
            return form

    return None


@lru_cache(maxsize=1)
def _build_wordlist_info_lookup() -> dict[str, dict]:
    lookup: dict[str, dict] = {}

    for level in HSK_LEVELS:
        for entry in _read_level_payload(level):
            for word in _extract_entry_words(entry):
                form = _find_form_for_word(entry, word)
                if form is None:
                    continue

                existing = lookup.get(word)
                if existing is not None and existing.get("level", 99) <= level:
                    continue

                lookup[word] = {
                    "level": level,
                    "traditional": form.get("t"),
                    "info": form.get("i"),
                    "meanings": form.get("m"),
                    "classifiers": form.get("c"),
                }

    return lookup


def _resolve_wordlist_info(word: str, lookup: dict[str, dict]) -> dict | None:
    exact = lookup.get(word)
    if exact is not None:
        return exact

    # Fall back to best-effort decomposition using existing wordlist entries.
    # This keeps the payload sourced from JSON wordlists even for unknown compounds.
    parts: list[dict] = []

    if len(word) > 1:
        for token in jieba.cut(word):
            token = token.strip()
            if not token or token == word:
                continue
            token_info = lookup.get(token)
            if token_info is not None:
                parts.append({"word": token, "info": token_info})

    if not parts:
        for char in word:
            char_info = lookup.get(char)
            if char_info is not None:
                parts.append({"word": char, "info": char_info})

    if not parts:
        return {
            "match": "not_found",
            "word": word,
            "note": "No match found in currently available local wordlist files.",
        }

    return {
        "match": "fallback",
        "parts": parts,
    }


def _format_priority_info(word: str, resolved_info: dict | None) -> dict:
    def _join_meanings(meanings: list[str]) -> list[str]:
        cleaned = [m.strip() for m in meanings if isinstance(m, str) and m.strip()]
        seen: set[str] = set()
        deduped: list[str] = []
        for meaning in cleaned:
            if meaning in seen:
                continue
            seen.add(meaning)
            deduped.append(meaning)
        return deduped

    if not isinstance(resolved_info, dict):
        return {
            "pronunciation": _word_to_pinyin(word),
            "meanings": ["No meaning found in current wordlists."],
        }

    if resolved_info.get("match") == "fallback":
        parts = resolved_info.get("parts")
        if not isinstance(parts, list):
            return {
                "pronunciation": _word_to_pinyin(word),
                "meanings": ["No meaning found in current wordlists."],
            }

        pronunciations: list[str] = []
        meanings: list[str] = []
        for part in parts:
            if not isinstance(part, dict):
                continue
            part_word = part.get("word")
            part_info = part.get("info")
            if not isinstance(part_info, dict):
                continue

            pinyin_info = part_info.get("info")
            if isinstance(pinyin_info, dict):
                y = pinyin_info.get("y")
                if isinstance(y, str) and y.strip():
                    label = f"{part_word}: {y.strip()}" if isinstance(part_word, str) and part_word.strip() else y.strip()
                    pronunciations.append(label)

            part_meanings = part_info.get("meanings")
            if isinstance(part_meanings, list):
                for meaning in part_meanings:
                    if isinstance(meaning, str) and meaning.strip():
                        meanings.append(meaning)

        readable_meanings = _join_meanings(meanings)
        pronunciation = "; ".join(pronunciations) if pronunciations else _word_to_pinyin(word)
        if not readable_meanings:
            readable_meanings = ["No meaning found in current wordlists."]
        return {
            "pronunciation": pronunciation,
            "meanings": readable_meanings,
        }

    if resolved_info.get("match") == "not_found":
        return {
            "pronunciation": _word_to_pinyin(word),
            "meanings": ["No meaning found in current wordlists."],
        }

    pinyin_info = resolved_info.get("info")
    pronunciation = _word_to_pinyin(word)
    if isinstance(pinyin_info, dict):
        y = pinyin_info.get("y")
        if isinstance(y, str) and y.strip():
            pronunciation = y.strip()

    meanings = resolved_info.get("meanings")
    readable_meanings = _join_meanings(meanings if isinstance(meanings, list) else [])
    if not readable_meanings:
        readable_meanings = ["No meaning found in current wordlists."]

    return {
        "pronunciation": pronunciation,
        "meanings": readable_meanings,
    }


def _read_level_payload(level: int) -> list[dict]:
    filename = f"{level}.min.json"
    local_file = WORDLISTS_DIR / filename

    if local_file.exists():
        try:
            payload = json.loads(local_file.read_text(encoding="utf-8"))
            if isinstance(payload, list):
                return [entry for entry in payload if isinstance(entry, dict)]
        except json.JSONDecodeError:
            logger.warning("Invalid JSON in local HSK wordlist: %s", local_file)

    remote_url = HSK_WORDLIST_URL.format(level=level)
    try:
        with urlopen(remote_url, timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, list):
                return []

            WORDLISTS_DIR.mkdir(parents=True, exist_ok=True)
            # Cache remote payload locally to keep subsequent runs offline-friendly.
            local_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            return [entry for entry in payload if isinstance(entry, dict)]
    except (URLError, TimeoutError, json.JSONDecodeError):
        logger.warning("Unable to fetch remote HSK wordlist: %s", remote_url)
        return []


@lru_cache(maxsize=1)
def _build_hsk_lookup() -> dict[str, int]:
    lookup: dict[str, int] = {}

    for level in HSK_LEVELS:
        for entry in _read_level_payload(level):
            for word in _extract_entry_words(entry):
                if word in lookup:
                    lookup[word] = min(level, lookup[word])
                else:
                    lookup[word] = level

    return lookup


def _estimate_hsk_level(word: str) -> int:
    lookup = _build_hsk_lookup()
    exact = lookup.get(word)
    if exact is not None:
        return exact

    return _fallback_hsk_level(word)


def build_vocab_screen(text: str) -> dict:
    cleaned_text = remove_punctuation(text or "")
    groups = {f"HSK {level}": [] for level in HSK_LEVELS}

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
    wordlist_info_lookup = _build_wordlist_info_lookup()
    priority_drill_set = []
    for row in ranked_words:
        if row["is_known"]:
            continue
        resolved_info = _resolve_wordlist_info(row["word"], wordlist_info_lookup)
        priority_drill_set.append(
            {
                "word": row["word"],
                "info": _format_priority_info(row["word"], resolved_info),
            }
        )
        if len(priority_drill_set) >= 12:
            break

    return {
        "cleaned_text": cleaned_text,
        "known_percentage": known_percentage,
        "total_occurrences": total_occurrences,
        "words": ranked_words,
        "unknown_words": unknown_words,
        "priority_drill_set": priority_drill_set,
    }
