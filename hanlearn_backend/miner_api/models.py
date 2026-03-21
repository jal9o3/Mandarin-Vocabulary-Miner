from django.conf import settings
from django.db import models


class UserFlashcard(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="flashcards")
    word = models.CharField(max_length=64)
    pinyin = models.CharField(max_length=128, blank=True)
    meaning = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "word", "meaning"], name="unique_user_flashcard_word_meaning"),
        ]

    def __str__(self) -> str:
        return str(self.word)
