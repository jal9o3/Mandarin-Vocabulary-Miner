import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .models import UserFlashcard
from .services import analyze_text, build_vocab_screen, load_vocab, parse_vocab_text, save_vocab


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

    flashcards_to_create = []
    for item in words_payload:
        word = ""
        pinyin_value = ""
        if isinstance(item, dict):
            raw_word = item.get("word")
            raw_pinyin = item.get("pinyin")
            word = raw_word.strip() if isinstance(raw_word, str) else ""
            pinyin_value = raw_pinyin.strip() if isinstance(raw_pinyin, str) else ""
        elif isinstance(item, str):
            word = item.strip()

        if not word:
            continue

        flashcards_to_create.append(UserFlashcard(user=request.user, word=word, pinyin=pinyin_value))

    if not flashcards_to_create:
        return JsonResponse({"created": 0, "total": UserFlashcard.objects.filter(user=request.user).count()})

    UserFlashcard.objects.bulk_create(flashcards_to_create, ignore_conflicts=True)
    total = UserFlashcard.objects.filter(user=request.user).count()
    return JsonResponse({"created": len(flashcards_to_create), "total": total})
