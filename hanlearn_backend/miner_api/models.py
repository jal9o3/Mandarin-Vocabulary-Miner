from django.conf import settings
from django.db import models
from django.utils import timezone


class Word(models.Model):
    text = models.CharField(max_length=64, unique=True)
    pinyin = models.CharField(max_length=128, blank=True)

    def __str__(self) -> str:
        return str(self.text)


class UserFlashcard(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="flashcards")
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name="flashcards")
    meaning = models.TextField(blank=True, default="")
    due_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_reviewed_at = models.DateTimeField(blank=True, null=True)
    interval_days = models.PositiveIntegerField(default=0)
    ease_factor = models.FloatField(default=2.5)
    consecutive_correct_reviews = models.PositiveIntegerField(default=0)
    review_count = models.PositiveIntegerField(default=0)
    lapse_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "word"], name="unique_user_flashcard_word"),
        ]

    def __str__(self) -> str:
        return str(self.word)
