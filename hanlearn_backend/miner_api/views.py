import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .models import UserFlashcard
from .services import analyze_text, build_vocab_screen, load_vocab, parse_vocab_text, resolve_word_flashcard_info, save_vocab


VOCAB_FILE = settings.BASE_DIR / "vocab.txt"


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


@require_GET
def vocab_view(request: HttpRequest) -> JsonResponse:
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

    screening = build_vocab_screen(text)
    return JsonResponse(screening)


@csrf_exempt
@require_http_methods(["POST"])
def analyze_text_view(request: HttpRequest) -> JsonResponse:
    payload = _json_body(request)
    text = payload.get("text", "")

    if not isinstance(text, str):
        return JsonResponse({"error": "Field 'text' must be a string."}, status=400)

    vocab_text = payload.get("vocab_text")
    if not isinstance(vocab_text, str):
        vocab_text = load_vocab(VOCAB_FILE)

    analysis = analyze_text(text=text, vocab_text=vocab_text)
    return JsonResponse(analysis)


@csrf_exempt
@require_http_methods(["POST"])
def analyze_file_view(request: HttpRequest) -> JsonResponse:
    upload = request.FILES.get("file")
    if upload is None:
        return JsonResponse({"error": "Upload a file in form field 'file'."}, status=400)

    try:
        text = upload.read().decode("utf-8")
    except UnicodeDecodeError:
        return JsonResponse({"error": "File must be UTF-8 encoded text."}, status=400)

    vocab_text = request.POST.get("vocab_text")
    if not isinstance(vocab_text, str):
        vocab_text = load_vocab(VOCAB_FILE)

    analysis = analyze_text(text=text, vocab_text=vocab_text)
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

    pending_entries: dict[tuple[str, str], str] = {}
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

        meaning_rows = meanings or [""]
        for meaning in meaning_rows:
            key = (word, meaning)
            # Keep first resolved pinyin for the (word, meaning) pair.
            if key in pending_entries:
                continue
            pending_entries[key] = pinyin_value

    if not pending_entries:
        return JsonResponse({"created": 0, "total": UserFlashcard.objects.filter(user=request.user).count()})

    candidate_words = {word for word, _ in pending_entries.keys()}
    candidate_meanings = {meaning for _, meaning in pending_entries.keys()}
    existing_pairs = set(
        UserFlashcard.objects.filter(
            user=request.user,
            word__in=candidate_words,
            meaning__in=candidate_meanings,
        ).values_list("word", "meaning")
    )

    new_pairs = set(pending_entries.keys()) - existing_pairs
    flashcards_to_create = [
        UserFlashcard(user=request.user, word=word, pinyin=pending_entries[(word, meaning)], meaning=meaning)
        for word, meaning in pending_entries.keys()
    ]

    UserFlashcard.objects.bulk_create(flashcards_to_create, ignore_conflicts=True)
    total = UserFlashcard.objects.filter(user=request.user).count()
    created_words = len({word for word, _ in new_pairs})
    return JsonResponse({"created": created_words, "total": total})


@require_GET
def flashcards_view(request: HttpRequest) -> JsonResponse:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Create an account or sign in to view flashcards."}, status=401)

    rows = list(
        UserFlashcard.objects.filter(user=request.user)
        .order_by("-created_at", "-id")
        .values("id", "word", "pinyin", "created_at", "meaning")
    )

    return JsonResponse({"flashcards": rows})
