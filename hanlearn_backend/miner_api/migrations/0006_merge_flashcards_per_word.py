from django.db import migrations, models


def _split_meanings(meaning_text: str) -> list[str]:
    parts = [part.strip() for part in (meaning_text or "").split(";") if part.strip()]
    deduped: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part in seen:
            continue
        seen.add(part)
        deduped.append(part)
    return deduped


def _merge_flashcards_per_word(apps, schema_editor):
    del schema_editor
    UserFlashcard = apps.get_model("miner_api", "UserFlashcard")

    grouped_flashcards: dict[tuple[int, int], list] = {}
    queryset = UserFlashcard.objects.select_related("word").order_by("user_id", "word_id", "created_at", "id")
    for flashcard in queryset:
        grouped_flashcards.setdefault((flashcard.user_id, flashcard.word_id), []).append(flashcard)

    for flashcards in grouped_flashcards.values():
        if len(flashcards) == 1:
            continue

        primary = flashcards[0]
        merged_meanings: list[str] = []
        for flashcard in flashcards:
            for meaning in _split_meanings(flashcard.meaning):
                if meaning not in merged_meanings:
                    merged_meanings.append(meaning)

        due_candidates = [flashcard.due_at for flashcard in flashcards if flashcard.due_at is not None]
        reviewed_candidates = [flashcard.last_reviewed_at for flashcard in flashcards if flashcard.last_reviewed_at is not None]

        primary.meaning = "; ".join(merged_meanings)
        if due_candidates:
            primary.due_at = min(due_candidates)
        if reviewed_candidates:
            primary.last_reviewed_at = max(reviewed_candidates)
        primary.interval_days = min(flashcard.interval_days for flashcard in flashcards)
        primary.ease_factor = min(flashcard.ease_factor for flashcard in flashcards)
        primary.consecutive_correct_reviews = min(flashcard.consecutive_correct_reviews for flashcard in flashcards)
        primary.review_count = sum(flashcard.review_count for flashcard in flashcards)
        primary.lapse_count = sum(flashcard.lapse_count for flashcard in flashcards)
        primary.save(
            update_fields=[
                "meaning",
                "due_at",
                "last_reviewed_at",
                "interval_days",
                "ease_factor",
                "consecutive_correct_reviews",
                "review_count",
                "lapse_count",
            ]
        )

        UserFlashcard.objects.filter(id__in=[flashcard.id for flashcard in flashcards[1:]]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("miner_api", "0005_add_sm2_scheduling_fields"),
    ]

    operations = [
        migrations.RunPython(_merge_flashcards_per_word, reverse_code=migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="userflashcard",
            name="unique_user_flashcard_word_meaning",
        ),
        migrations.AddConstraint(
            model_name="userflashcard",
            constraint=models.UniqueConstraint(fields=("user", "word"), name="unique_user_flashcard_word"),
        ),
        migrations.AlterField(
            model_name="userflashcard",
            name="meaning",
            field=models.TextField(blank=True, default=""),
        ),
    ]