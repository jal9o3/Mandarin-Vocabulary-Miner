from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("miner_api", "0004_normalize_flashcard_words"),
    ]

    operations = [
        migrations.AddField(
            model_name="userflashcard",
            name="consecutive_correct_reviews",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="due_at",
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="ease_factor",
            field=models.FloatField(default=2.5),
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="interval_days",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="lapse_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="last_reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userflashcard",
            name="review_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]