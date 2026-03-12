from django.urls import path

from .views import analyze_file_view, analyze_text_view, update_vocab_view, vocab_screen_view, vocab_view


urlpatterns = [
    path("vocab", vocab_view, name="vocab-get"),
    path("vocab/update", update_vocab_view, name="vocab-update"),
    path("vocab-screen", vocab_screen_view, name="vocab-screen"),
    path("analyze", analyze_text_view, name="analyze-text"),
    path("analyze-file", analyze_file_view, name="analyze-file"),
]
