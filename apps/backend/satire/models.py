from django.db import models

from core.choices import HeadlineTone, RiskLevel


class SatiricalHeadline(models.Model):
    incident = models.ForeignKey(
        "press.Incident",
        on_delete=models.CASCADE,
        related_name="satirical_headlines",
    )
    text = models.CharField(max_length=140)
    tone = models.CharField(max_length=20, choices=HeadlineTone.choices)
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices)
    why_safe = models.TextField(blank=True, null=True)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.text

