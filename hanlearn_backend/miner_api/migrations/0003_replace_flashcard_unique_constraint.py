from django.db import migrations, models


def _replace_unique_index(apps, schema_editor):
    del apps
    table = "miner_api_userflashcard"
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table)

    if "unique_user_flashcard_word" in constraints:
        if connection.vendor == "mysql":
            schema_editor.execute(f"DROP INDEX unique_user_flashcard_word ON {table}")
        elif connection.vendor == "postgresql":
            schema_editor.execute(f"ALTER TABLE {table} DROP CONSTRAINT unique_user_flashcard_word")
        else:
            schema_editor.execute("DROP INDEX IF EXISTS unique_user_flashcard_word")

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table)

    if "unique_user_flashcard_word_meaning" not in constraints:
        schema_editor.execute(
            "CREATE UNIQUE INDEX unique_user_flashcard_word_meaning "
            f"ON {table} (user_id, word, meaning)"
        )


def _restore_unique_index(apps, schema_editor):
    del apps
    table = "miner_api_userflashcard"
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table)

    if "unique_user_flashcard_word_meaning" in constraints:
        if connection.vendor == "mysql":
            schema_editor.execute(f"DROP INDEX unique_user_flashcard_word_meaning ON {table}")
        elif connection.vendor == "postgresql":
            schema_editor.execute(f"ALTER TABLE {table} DROP CONSTRAINT unique_user_flashcard_word_meaning")
        else:
            schema_editor.execute("DROP INDEX IF EXISTS unique_user_flashcard_word_meaning")

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table)

    if "unique_user_flashcard_word" not in constraints:
        schema_editor.execute(
            "CREATE UNIQUE INDEX unique_user_flashcard_word "
            f"ON {table} (user_id, word)"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("miner_api", "0002_userflashcard_meaning"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userflashcard",
            name="meaning",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_replace_unique_index, reverse_code=_restore_unique_index),
            ],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="userflashcard",
                    name="unique_user_flashcard_word",
                ),
                migrations.AddConstraint(
                    model_name="userflashcard",
                    constraint=models.UniqueConstraint(
                        fields=("user", "word", "meaning"),
                        name="unique_user_flashcard_word_meaning",
                    ),
                ),
            ],
        ),
    ]
