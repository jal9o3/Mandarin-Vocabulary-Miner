from django.db import migrations, models
import django.db.models.deletion


def _populate_word_foreign_keys(apps, schema_editor):
    del schema_editor
    UserFlashcard = apps.get_model("miner_api", "UserFlashcard")
    Word = apps.get_model("miner_api", "Word")

    words_by_text: dict[str, str] = {}
    for flashcard in UserFlashcard.objects.exclude(word_text="").order_by("word_text", "id"):
        if flashcard.word_text not in words_by_text:
            words_by_text[flashcard.word_text] = flashcard.pinyin
        elif not words_by_text[flashcard.word_text] and flashcard.pinyin:
            words_by_text[flashcard.word_text] = flashcard.pinyin

    Word.objects.bulk_create(
        [Word(text=text, pinyin=pinyin) for text, pinyin in words_by_text.items()],
        ignore_conflicts=True,
    )

    word_ids = dict(Word.objects.filter(text__in=words_by_text.keys()).values_list("text", "id"))
    for flashcard in UserFlashcard.objects.exclude(word_text=""):
        flashcard.word_id = word_ids.get(flashcard.word_text)
        flashcard.save(update_fields=["word"])


def _restore_word_text_fields(apps, schema_editor):
    del schema_editor
    UserFlashcard = apps.get_model("miner_api", "UserFlashcard")

    for flashcard in UserFlashcard.objects.select_related("word"):
        flashcard.word_text = flashcard.word.text
        flashcard.pinyin = flashcard.word.pinyin
        flashcard.save(update_fields=["word_text", "pinyin"])


class Migration(migrations.Migration):

    dependencies = [
        ("miner_api", "0003_replace_flashcard_unique_constraint"),
    ]

    operations = [
        migrations.RenameField(
            model_name="userflashcard",
            old_name="word",
            new_name="word_text",
        ),
        migrations.CreateModel(
            name="Word",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.CharField(max_length=64, unique=True)),
                ("pinyin", models.CharField(blank=True, max_length=128)),
            ],
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="word",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="flashcards",
                to="miner_api.word",
            ),
        ),
        migrations.RunPython(_populate_word_foreign_keys, reverse_code=_restore_word_text_fields),
        migrations.RemoveConstraint(
            model_name="userflashcard",
            name="unique_user_flashcard_word_meaning",
        ),
        migrations.RemoveField(
            model_name="userflashcard",
            name="pinyin",
        ),
        migrations.RemoveField(
            model_name="userflashcard",
            name="word_text",
        ),
        migrations.AlterField(
            model_name="userflashcard",
            name="word",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="flashcards",
                to="miner_api.word",
            ),
        ),
        migrations.AddConstraint(
            model_name="userflashcard",
            constraint=models.UniqueConstraint(
                fields=("user", "word", "meaning"),
                name="unique_user_flashcard_word_meaning",
            ),
        ),
    ]