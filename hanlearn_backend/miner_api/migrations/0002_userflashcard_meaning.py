from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("miner_api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userflashcard",
            name="meaning",
            field=models.TextField(blank=True, default=""),
        ),
    ]
