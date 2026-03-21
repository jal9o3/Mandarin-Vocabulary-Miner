from django.urls import path

from .views import (
    analyze_file_view,
    analyze_text_view,
    auth_me_view,
    flashcards_view,
    create_flashcards_view,
    login_view,
    logout_view,
    register_view,
    update_vocab_view,
    vocab_screen_view,
    vocab_view,
)


urlpatterns = [
    path("vocab", vocab_view, name="vocab-get"),
    path("vocab/update", update_vocab_view, name="vocab-update"),
    path("vocab-screen", vocab_screen_view, name="vocab-screen"),
    path("analyze", analyze_text_view, name="analyze-text"),
    path("analyze-file", analyze_file_view, name="analyze-file"),
    path("auth/register", register_view, name="auth-register"),
    path("auth/login", login_view, name="auth-login"),
    path("auth/logout", logout_view, name="auth-logout"),
    path("auth/me", auth_me_view, name="auth-me"),
    path("flashcards", flashcards_view, name="flashcards-list"),
    path("flashcards/create", create_flashcards_view, name="flashcards-create"),
]
