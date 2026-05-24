from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="LlmProviderUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(db_index=True, max_length=40)),
                (
                    "window_kind",
                    models.CharField(
                        choices=[("day", "Day"), ("minute", "Minute")],
                        db_index=True,
                        max_length=10,
                    ),
                ),
                ("window_start", models.DateTimeField(db_index=True)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
        migrations.AddConstraint(
            model_name="llmproviderusage",
            constraint=models.UniqueConstraint(
                fields=("provider", "window_kind", "window_start"),
                name="unique_llm_provider_usage_window",
            ),
        ),
        migrations.AddIndex(
            model_name="llmproviderusage",
            index=models.Index(fields=["provider", "window_kind", "window_start"], name="core_llm_usage_window_idx"),
        ),
    ]
