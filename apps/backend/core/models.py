from django.db import models
from django.utils import timezone


class LlmProviderUsage(models.Model):
    WINDOW_DAY = "day"
    WINDOW_MINUTE = "minute"
    WINDOW_CHOICES = (
        (WINDOW_DAY, "Day"),
        (WINDOW_MINUTE, "Minute"),
    )

    provider = models.CharField(max_length=40, db_index=True)
    window_kind = models.CharField(max_length=10, choices=WINDOW_CHOICES, db_index=True)
    window_start = models.DateTimeField(db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "window_kind", "window_start"],
                name="unique_llm_provider_usage_window",
            )
        ]
        indexes = [models.Index(fields=["provider", "window_kind", "window_start"], name="core_llm_usage_window_idx")]

    def __str__(self) -> str:
        return f"{self.provider}:{self.window_kind}:{self.window_start}={self.attempts}"
