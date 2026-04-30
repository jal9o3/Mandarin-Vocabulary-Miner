import json
import csv
import math
from datetime import timedelta

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.conf import settings
from django.db import transaction
from django.http import HttpRequest, JsonResponse, HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .models import FlashcardReviewSubmission, SavedText, UserFlashcard, Word
from .services import analyze_text, build_vocab_screen, compute_text_hsk_level, load_vocab, parse_vocab_text, resolve_word_flashcard_info, save_vocab


VOCAB_FILE = settings.BASE_DIR / "vocab.txt"
MINIMUM_EASE_FACTOR = 1.3
MAXIMUM_EASE_FACTOR = 3.0
MAX_INTERVAL_DAYS = 36500
MAX_ANALYZE_TEXT_CHARS = 60_000
MAX_ANALYZE_UPLOAD_BYTES = 5 * 1024 * 1024


def _clamp_ease_factor(value: float) -> float:
    return min(MAXIMUM_EASE_FACTOR, max(MINIMUM_EASE_FACTOR, value))


def _round_half_up(value: float) -> int:
    # Use explicit half-up rounding so interval growth stays predictable.
    return math.floor(value + 0.5)


def _split_meanings(meaning_text: str) -> list[str]:
    parts = [part.strip() for part in meaning_text.split(";") if part.strip()]
    deduped: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part in seen:
            continue
        seen.add(part)
        deduped.append(part)
    return deduped


def _merge_meanings(existing_meaning: str, incoming_meanings: list[str]) -> str:
    merged = _split_meanings(existing_meaning)
    seen = set(merged)

    for meaning in incoming_meanings:
        cleaned = meaning.strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        merged.append(cleaned)

    return "; ".join(merged)


def _serialize_flashcard(flashcard: UserFlashcard) -> dict:
    return {
        "id": flashcard.id,
        "word": flashcard.word.text,
        "pinyin": flashcard.word.pinyin,
        "created_at": flashcard.created_at.isoformat(),
        "meaning": flashcard.meaning,
        "due_at": flashcard.due_at.isoformat(),
        "last_reviewed_at": flashcard.last_reviewed_at.isoformat() if flashcard.last_reviewed_at else None,
        "interval_days": flashcard.interval_days,
        "ease_factor": flashcard.ease_factor,
        "consecutive_correct_reviews": flashcard.consecutive_correct_reviews,
        "review_count": flashcard.review_count,
        "lapse_count": flashcard.lapse_count,
    }


def _apply_sm2_review(flashcard: UserFlashcard, rating: str) -> None:
    now = timezone.now()
    current_interval = max(0, int(flashcard.interval_days or 0))
    current_streak = max(0, int(flashcard.consecutive_correct_reviews or 0))
    current_ease = _clamp_ease_factor(float(flashcard.ease_factor or MINIMUM_EASE_FACTOR))

    if rating == "again":
        flashcard.ease_factor = _clamp_ease_factor(current_ease - 0.2)
        flashcard.interval_days = 0
        flashcard.consecutive_correct_reviews = 0
        flashcard.lapse_count += 1
        # Requeue immediately so failed cards are seen again in the same session.
        flashcard.due_at = now
    else:
        next_streak = current_streak + 1
        ease_factor = current_ease

        if rating == "hard":
            ease_factor = _clamp_ease_factor(current_ease - 0.15)
        elif rating == "easy":
            ease_factor = _clamp_ease_factor(current_ease + 0.15)

        if next_streak == 1:
            interval_days = 1 if rating != "easy" else 3
        elif next_streak == 2:
            if rating == "hard":
                interval_days = 2
            elif rating == "easy":
                interval_days = 6
            else:
                interval_days = 3
        else:
            base_interval = max(1, current_interval)
            multiplier = ease_factor
            if rating == "hard":
                multiplier *= 0.8
            elif rating == "easy":
                multiplier *= 1.3

            interval_days = max(base_interval + 1, _round_half_up(base_interval * multiplier))

        interval_days = min(MAX_INTERVAL_DAYS, interval_days)

        flashcard.ease_factor = ease_factor
        flashcard.interval_days = interval_days
        flashcard.consecutive_correct_reviews = next_streak
        flashcard.due_at = now + timedelta(days=interval_days)

    flashcard.review_count += 1
    flashcard.last_reviewed_at = now


def _json_body(request: HttpRequest) -> dict:
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}


def _string_field(payload: dict, key: str) -> str | None:
    value = payload.get(key)
    if isinstance(value, str):
        normalized = value.strip()
        if normalized:
            return normalized
    return None


def _coerce_flashcard_ids(raw_ids: object) -> list[int] | None:
    if not isinstance(raw_ids, list):
        return None

    cleaned: list[int] = []
    seen: set[int] = set()
    for value in raw_ids:
        if not isinstance(value, int):
            return None
        if value <= 0 or value in seen:
            continue
        seen.add(value)
        cleaned.append(value)

    return cleaned


def _validate_text_length(text: str, *, field_name: str = "text") -> JsonResponse | None:
    if len(text) > MAX_ANALYZE_TEXT_CHARS:
        return JsonResponse(
            {
                "error": (
                    f"Field '{field_name}' is too large. "
                    f"Maximum allowed length is {MAX_ANALYZE_TEXT_CHARS} characters."
                )
            },
            status=413,
        )

    return None


@require_GET
def vocab_view(_request: HttpRequest) -> JsonResponse:
    vocab_text = load_vocab(VOCAB_FILE)
    return JsonResponse(
        {
            "vocab_text": vocab_text,
            "words": parse_vocab_text(vocab_text),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def register_view(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    username = _string_field(payload, "username")
    password = _string_field(payload, "password")

    if username is None or password is None:
        return JsonResponse({"error": "Provide non-empty 'username' and 'password'."}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username is already taken."}, status=400)

    user = User.objects.create_user(username=username, password=password)
    login(request, user)
    return JsonResponse({"username": user.username, "is_authenticated": True}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    username = _string_field(payload, "username")
    password = _string_field(payload, "password")

    if username is None or password is None:
        return JsonResponse({"error": "Provide non-empty 'username' and 'password'."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid username or password."}, status=401)

    login(request, user)
    return JsonResponse({"username": user.username, "is_authenticated": True})


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request: HttpRequest) -> JsonResponse:
    logout(request)
    return JsonResponse({"is_authenticated": False})


@require_GET
def auth_me_view(request: HttpRequest) -> JsonResponse:
    if request.user.is_authenticated:
        return JsonResponse({"is_authenticated": True, "username": request.user.username})
    return JsonResponse({"is_authenticated": False, "username": None})


@csrf_exempt
@require_http_methods(["PUT", "POST"])
def update_username_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)

    payload = _json_body(request)
    new_username = _string_field(payload, "new_username")
    current_password = _string_field(payload, "current_password")

    if new_username is None or current_password is None:
        return JsonResponse({"error": "Provide non-empty 'new_username' and 'current_password'."}, status=400)

    user = request.user
    if not user.check_password(current_password):
        return JsonResponse({"error": "Current password is incorrect."}, status=400)

    if new_username == user.username:
        return JsonResponse({"error": "New username must be different from current username."}, status=400)

    if User.objects.filter(username=new_username).exclude(id=user.id).exists():
        return JsonResponse({"error": "Username is already taken."}, status=400)

    user.username = new_username
    user.save(update_fields=["username"])
    return JsonResponse({"username": user.username, "is_authenticated": True})


@csrf_exempt
@require_http_methods(["PUT", "POST"])
def update_password_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)

    payload = _json_body(request)
    current_password = _string_field(payload, "current_password")
    new_password = _string_field(payload, "new_password")

    if current_password is None or new_password is None:
        return JsonResponse({"error": "Provide non-empty 'current_password' and 'new_password'."}, status=400)

    user = request.user
    if not user.check_password(current_password):
        return JsonResponse({"error": "Current password is incorrect."}, status=400)

    if current_password == new_password:
        return JsonResponse({"error": "New password must be different from current password."}, status=400)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    update_session_auth_hash(request, user)
    return JsonResponse({"is_authenticated": True})


@csrf_exempt
@require_http_methods(["PUT", "POST"])
def update_vocab_view(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    vocab_text = payload.get("vocab_text")
    words = payload.get("words")

    if vocab_text is None and isinstance(words, list):
        vocab_text = " ".join(str(word).strip() for word in words if str(word).strip())

    if not isinstance(vocab_text, str):
        return JsonResponse(
            {"error": "Provide 'vocab_text' as a string or 'words' as a list."},
            status=400,
        )

    save_vocab(VOCAB_FILE, vocab_text)
    return JsonResponse(
        {
            "vocab_text": vocab_text,
            "words": parse_vocab_text(vocab_text),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def vocab_screen_view(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    text = payload.get("text", "")

    if not isinstance(text, str):
        return JsonResponse({"error": "Field 'text' must be a string."}, status=400)

    too_large = _validate_text_length(text)
    if too_large is not None:
        return too_large

    screening = build_vocab_screen(text)
    return JsonResponse(screening)


@csrf_exempt
@require_http_methods(["POST"])
def analyze_text_view(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    text = payload.get("text", "")

    if not isinstance(text, str):
        return JsonResponse({"error": "Field 'text' must be a string."}, status=400)

    too_large = _validate_text_length(text)
    if too_large is not None:
        return too_large

    vocab_text = payload.get("vocab_text")
    if not isinstance(vocab_text, str):
        vocab_text = load_vocab(VOCAB_FILE)

    saved_flashcard_words: set[str] = set()
    if request.user.is_authenticated:
        saved_flashcard_words = set(
            UserFlashcard.objects.filter(user=request.user).values_list("word__text", flat=True)
        )

    analysis = analyze_text(
        text=text,
        vocab_text=vocab_text,
        saved_flashcard_words=saved_flashcard_words,
    )
    return JsonResponse(analysis)


@csrf_exempt
@require_http_methods(["POST"])
def analyze_file_view(request: HttpRequest) -> JsonResponse:
    upload = request.FILES.get("file")
    if upload is None:
        return JsonResponse({"error": "Upload a file in form field 'file'."}, status=400)

    if upload.size > MAX_ANALYZE_UPLOAD_BYTES:
        return JsonResponse(
            {"error": f"Uploaded file is too large. Maximum allowed size is {MAX_ANALYZE_UPLOAD_BYTES // (1024 * 1024)} MB."},
            status=413,
        )

    try:
        text = upload.read().decode("utf-8")
    except UnicodeDecodeError:
        return JsonResponse({"error": "File must be UTF-8 encoded text."}, status=400)

    too_large = _validate_text_length(text, field_name="file")
    if too_large is not None:
        return too_large

    vocab_text = request.POST.get("vocab_text")
    if not isinstance(vocab_text, str):
        vocab_text = load_vocab(VOCAB_FILE)

    saved_flashcard_words: set[str] = set()
    if request.user.is_authenticated:
        saved_flashcard_words = set(
            UserFlashcard.objects.filter(user=request.user).values_list("word__text", flat=True)
        )

    analysis = analyze_text(
        text=text,
        vocab_text=vocab_text,
        saved_flashcard_words=saved_flashcard_words,
    )
    analysis["filename"] = upload.name
    return JsonResponse(analysis)


@csrf_exempt
@require_http_methods(["POST"])
def create_flashcards_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Create an account or sign in to save flashcards."}, status=401)

    payload = _json_body(request)
    words_payload = payload.get("words")
    if not isinstance(words_payload, list):
        return JsonResponse({"error": "Provide 'words' as a list."}, status=400)

    pending_meanings: dict[str, list[str]] = {}
    pinyin_by_word: dict[str, str] = {}
    for item in words_payload:
        word = ""
        pinyin_value = ""
        meanings: list[str] = []
        if isinstance(item, dict):
            raw_word = item.get("word")
            raw_pinyin = item.get("pinyin")
            word = raw_word.strip() if isinstance(raw_word, str) else ""
            pinyin_value = raw_pinyin.strip() if isinstance(raw_pinyin, str) else ""
            raw_meaning = item.get("meaning")
            raw_meanings = item.get("meanings")
            if isinstance(raw_meaning, str) and raw_meaning.strip():
                meanings = [raw_meaning.strip()]
            elif isinstance(raw_meanings, list):
                meanings = [meaning.strip() for meaning in raw_meanings if isinstance(meaning, str) and meaning.strip()]
        elif isinstance(item, str):
            word = item.strip()

        if not word:
            continue

        if not pinyin_value or not meanings:
            resolved = resolve_word_flashcard_info(word)
            if not pinyin_value:
                resolved_pinyin = resolved.get("pinyin")
                if isinstance(resolved_pinyin, str) and resolved_pinyin.strip():
                    pinyin_value = resolved_pinyin.strip()
            if not meanings:
                resolved_meanings = resolved.get("meanings")
                if isinstance(resolved_meanings, list):
                    meanings = [meaning.strip() for meaning in resolved_meanings if isinstance(meaning, str) and meaning.strip()]

        if pinyin_value and word not in pinyin_by_word:
            pinyin_by_word[word] = pinyin_value

        existing_meanings = pending_meanings.setdefault(word, [])
        for meaning in meanings:
            cleaned = meaning.strip()
            if not cleaned or cleaned in existing_meanings:
                continue
            existing_meanings.append(cleaned)

    if not pending_meanings:
        return JsonResponse({"created": 0, "total": UserFlashcard.objects.filter(user=request.user).count()})

    candidate_words = set(pending_meanings.keys())

    with transaction.atomic():
        existing_words = {entry.text: entry for entry in Word.objects.filter(text__in=candidate_words)}
        words_to_create = [
            Word(text=word, pinyin=pinyin_by_word.get(word, ""))
            for word in candidate_words
            if word not in existing_words
        ]
        if words_to_create:
            Word.objects.bulk_create(words_to_create, ignore_conflicts=True)
            existing_words = {entry.text: entry for entry in Word.objects.filter(text__in=candidate_words)}

        words_to_update: list[Word] = []
        for word, pinyin_value in pinyin_by_word.items():
            entry = existing_words.get(word)
            if entry is None or entry.pinyin or not pinyin_value:
                continue
            entry.pinyin = pinyin_value
            words_to_update.append(entry)

        if words_to_update:
            Word.objects.bulk_update(words_to_update, ["pinyin"])

        existing_flashcards = {
            flashcard.word.text: flashcard
            for flashcard in UserFlashcard.objects.filter(user=request.user, word__text__in=candidate_words).select_related("word")
        }

        created_words = 0
        flashcards_to_update: list[UserFlashcard] = []
        flashcards_to_create = [
            UserFlashcard(
                user=request.user,
                word=existing_words[word],
                meaning=_merge_meanings("", pending_meanings[word]),
            )
            for word in candidate_words
            if word not in existing_flashcards
        ]

        created_words = len(flashcards_to_create)

        for word, flashcard in existing_flashcards.items():
            merged_meaning = _merge_meanings(flashcard.meaning, pending_meanings.get(word, []))
            if merged_meaning == flashcard.meaning:
                continue
            flashcard.meaning = merged_meaning
            flashcards_to_update.append(flashcard)

        UserFlashcard.objects.bulk_create(flashcards_to_create, ignore_conflicts=True)
        if flashcards_to_update:
            UserFlashcard.objects.bulk_update(flashcards_to_update, ["meaning"])

    total = UserFlashcard.objects.filter(user=request.user).count()
    return JsonResponse({"created": created_words, "total": total})


@require_GET
def flashcards_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Create an account or sign in to view flashcards."}, status=401)

    due_only = request.GET.get("due_only") in {"1", "true", "yes"}
    queryset = UserFlashcard.objects.filter(user=request.user).select_related("word")
    if due_only:
        queryset = queryset.filter(due_at__lte=timezone.now()).order_by("due_at", "id")
    else:
        queryset = queryset.order_by("due_at", "-created_at", "-id")

    rows = [
        _serialize_flashcard(flashcard)
        for flashcard in queryset
    ]

    now = timezone.now()
    total_count = UserFlashcard.objects.filter(user=request.user).count()
    due_count = UserFlashcard.objects.filter(user=request.user, due_at__lte=now).count()

    return JsonResponse({"flashcards": rows, "total": total_count, "due": due_count, "due_only": due_only})


@require_GET
def export_flashcards_csv_view(request: HttpRequest) -> HttpResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Create an account or sign in to export flashcards."}, status=401)

    flashcards = (
        UserFlashcard.objects.filter(user=request.user)
        .select_related("word")
        .order_by("word__text", "id")
    )

    class Echo:
        def write(self, value: str) -> str:
            return value

    pseudo_buffer = Echo()
    writer = csv.writer(pseudo_buffer)

    def row_stream():
        yield writer.writerow(["Front", "Back"])
        for flashcard in flashcards.iterator(chunk_size=200):
            pinyin = flashcard.word.pinyin.strip()
            meaning = flashcard.meaning.strip()
            back = f"{pinyin}\n{meaning}" if pinyin else meaning
            yield writer.writerow([flashcard.word.text, back])

    response = StreamingHttpResponse(row_stream(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="hanlearn-flashcards.csv"'
    return response


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def flashcard_detail_view(request: HttpRequest, flashcard_id: int) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Create an account or sign in to manage flashcards."}, status=401)

    try:
        flashcard = UserFlashcard.objects.select_related("word").get(id=flashcard_id, user=request.user)
    except UserFlashcard.DoesNotExist:
        return JsonResponse({"error": "Flashcard not found."}, status=404)

    if request.method == "DELETE":
        flashcard.delete()
        return JsonResponse({"deleted": True, "id": flashcard_id})

    payload = _json_body(request)
    word_value = payload.get("word")
    pinyin_value = payload.get("pinyin")
    meaning_value = payload.get("meaning")

    if not isinstance(word_value, str) or not word_value.strip():
        return JsonResponse({"error": "Provide non-empty 'word' as a string."}, status=400)
    if not isinstance(pinyin_value, str):
        return JsonResponse({"error": "Provide 'pinyin' as a string."}, status=400)
    if not isinstance(meaning_value, str):
        return JsonResponse({"error": "Provide 'meaning' as a string."}, status=400)

    next_word_text = word_value.strip()
    next_pinyin = pinyin_value.strip()
    next_meaning = meaning_value.strip()

    with transaction.atomic():
        next_word = flashcard.word

        if flashcard.word.text != next_word_text:
            next_word, _ = Word.objects.get_or_create(
                text=next_word_text,
                defaults={"pinyin": next_pinyin},
            )

            if next_pinyin and next_word.pinyin != next_pinyin:
                next_word.pinyin = next_pinyin
                next_word.save(update_fields=["pinyin"])

            duplicate = (
                UserFlashcard.objects.select_for_update()
                .filter(user=request.user, word=next_word)
                .exclude(id=flashcard.id)
                .first()
            )
            if duplicate is not None:
                merged_meaning = _merge_meanings(duplicate.meaning, [next_meaning] if next_meaning else [])
                if merged_meaning != duplicate.meaning:
                    duplicate.meaning = merged_meaning
                    duplicate.save(update_fields=["meaning"])

                flashcard.delete()
                return JsonResponse(
                    {
                        "flashcard": _serialize_flashcard(duplicate),
                        "merged": True,
                        "deleted_id": flashcard_id,
                    }
                )
        elif next_pinyin != flashcard.word.pinyin:
            flashcard.word.pinyin = next_pinyin
            flashcard.word.save(update_fields=["pinyin"])

        flashcard.word = next_word
        flashcard.meaning = next_meaning
        flashcard.save(update_fields=["word", "meaning"])

    return JsonResponse({"flashcard": _serialize_flashcard(flashcard), "merged": False})


@csrf_exempt
@require_http_methods(["POST"])
def review_flashcard_view(request: HttpRequest, flashcard_id: int) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Create an account or sign in to review flashcards."}, status=401)

    payload = _json_body(request)
    rating = payload.get("rating")
    if rating not in {"again", "hard", "good", "easy"}:
        return JsonResponse({"error": "Provide 'rating' as one of: again, hard, good, easy."}, status=400)

    idempotency_key = payload.get("idempotency_key")
    if idempotency_key is not None:
        if not isinstance(idempotency_key, str):
            return JsonResponse({"error": "Provide 'idempotency_key' as a string."}, status=400)
        idempotency_key = idempotency_key.strip()
        if not idempotency_key:
            return JsonResponse({"error": "Field 'idempotency_key' cannot be empty."}, status=400)
        if len(idempotency_key) > 128:
            return JsonResponse({"error": "Field 'idempotency_key' is too long."}, status=400)

    with transaction.atomic():
        try:
            flashcard = (
                UserFlashcard.objects.select_for_update()
                .select_related("word")
                .get(id=flashcard_id, user=request.user)
            )
        except UserFlashcard.DoesNotExist:
            return JsonResponse({"error": "Flashcard not found."}, status=404)

        if idempotency_key:
            submission, created = FlashcardReviewSubmission.objects.select_for_update().get_or_create(
                user=request.user,
                idempotency_key=idempotency_key,
                defaults={
                    "flashcard": flashcard,
                    "rating": rating,
                    "response_payload": {},
                },
            )

            if not created:
                if submission.flashcard_id != flashcard.id:
                    return JsonResponse({"error": "Idempotency key already used for another flashcard."}, status=409)
                if submission.rating != rating:
                    return JsonResponse({"error": "Idempotency key already used with another rating."}, status=409)
                if submission.response_payload:
                    replay_payload = dict(submission.response_payload)
                    replay_payload["idempotency_replayed"] = True
                    return JsonResponse(replay_payload)

        _apply_sm2_review(flashcard, rating)
        flashcard.save(
            update_fields=[
                "due_at",
                "last_reviewed_at",
                "interval_days",
                "ease_factor",
                "consecutive_correct_reviews",
                "review_count",
                "lapse_count",
            ]
        )

        due_remaining = UserFlashcard.objects.filter(user=request.user, due_at__lte=timezone.now()).count()
        response_payload = {
            "flashcard": _serialize_flashcard(flashcard),
            "due_remaining": due_remaining,
            "idempotency_replayed": False,
        }

        if idempotency_key:
            submission.response_payload = response_payload
            submission.save(update_fields=["response_payload"])

    return JsonResponse(response_payload)


@csrf_exempt
@require_http_methods(["POST"])
def bulk_delete_flashcards_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to manage flashcards."}, status=401)

    payload = _json_body(request)
    ids = _coerce_flashcard_ids(payload.get("ids"))
    if ids is None:
        return JsonResponse({"error": "Provide 'ids' as a list of numeric flashcard ids."}, status=400)

    if not ids:
        return JsonResponse({"deleted": 0, "deleted_ids": [], "missing_ids": []})

    owned_queryset = UserFlashcard.objects.filter(user=request.user, id__in=ids)
    deleted_ids = list(owned_queryset.values_list("id", flat=True))
    deleted_count, _ = owned_queryset.delete()

    deleted_set = set(deleted_ids)
    missing_ids = [flashcard_id for flashcard_id in ids if flashcard_id not in deleted_set]

    return JsonResponse(
        {
            "deleted": deleted_count,
            "deleted_ids": deleted_ids,
            "missing_ids": missing_ids,
        }
    )


@require_GET
def library_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to view your library."}, status=401)

    texts = SavedText.objects.filter(user=request.user)
    rows = [
        {"id": t.id, "title": t.title, "content": t.content, "hsk_level": t.hsk_level, "created_at": t.created_at.isoformat()}
        for t in texts
    ]
    return JsonResponse({"texts": rows})


@csrf_exempt
@require_http_methods(["POST"])
def save_text_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to save texts to your library."}, status=401)

    payload = _json_body(request)
    content = payload.get("content", "")
    title = payload.get("title", "")

    if not isinstance(content, str) or not content.strip():
        return JsonResponse({"error": "Provide non-empty 'content' as a string."}, status=400)

    if not isinstance(title, str):
        title = ""

    clean_content = content.strip()
    hsk_level = compute_text_hsk_level(clean_content)

    saved = SavedText.objects.create(
        user=request.user,
        title=title.strip(),
        content=clean_content,
        hsk_level=hsk_level,
    )
    return JsonResponse(
        {"id": saved.id, "title": saved.title, "content": saved.content, "hsk_level": saved.hsk_level, "created_at": saved.created_at.isoformat()},
        status=201,
    )


@csrf_exempt
@require_http_methods(["PATCH"])
def edit_saved_text_view(request: HttpRequest, text_id: int) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to manage your library."}, status=401)

    try:
        saved = SavedText.objects.get(id=text_id, user=request.user)
    except SavedText.DoesNotExist:
        return JsonResponse({"error": "Text not found."}, status=404)

    payload = _json_body(request)
    content = payload.get("content", saved.content)
    title = payload.get("title", saved.title)

    if not isinstance(content, str) or not content.strip():
        return JsonResponse({"error": "Provide non-empty 'content' as a string."}, status=400)
    if not isinstance(title, str):
        title = saved.title

    saved.content = content.strip()
    saved.title = title.strip()
    saved.hsk_level = compute_text_hsk_level(saved.content)
    saved.save(update_fields=["content", "title", "hsk_level"])

    return JsonResponse(
        {"id": saved.id, "title": saved.title, "content": saved.content, "hsk_level": saved.hsk_level, "created_at": saved.created_at.isoformat()}
    )


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_saved_text_view(request: HttpRequest, text_id: int) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to manage your library."}, status=401)

    try:
        saved = SavedText.objects.get(id=text_id, user=request.user)
    except SavedText.DoesNotExist:
        return JsonResponse({"error": "Text not found."}, status=404)

    saved.delete()
    return JsonResponse({"deleted": True, "id": text_id})
