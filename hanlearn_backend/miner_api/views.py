import json

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .services import analyze_text, build_vocab_screen, load_vocab, parse_vocab_text, save_vocab


VOCAB_FILE = settings.BASE_DIR / "vocab.txt"


def _json_body(request: HttpRequest) -> dict:
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}


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
