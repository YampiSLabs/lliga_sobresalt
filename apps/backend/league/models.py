from django.db import models
from django.utils import timezone

from core.choices import IncidentCategory, RoundStatus


class City(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    province = models.CharField(max_length=120, blank=True, null=True)
    aliases = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "cities"

    def __str__(self) -> str:
        return self.name


class ScoringRule(models.Model):
    category = models.CharField(max_length=40, choices=IncidentCategory.choices, unique=True)
    base_points = models.FloatField()
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["category"]

    def __str__(self) -> str:
        return f"{self.category}: {self.base_points:g}"


class LeagueSeason(models.Model):
    name = models.CharField(max_length=160)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-starts_at"]

    def __str__(self) -> str:
        return self.name


class LeagueRound(models.Model):
    season = models.ForeignKey(LeagueSeason, on_delete=models.CASCADE, related_name="rounds")
    name = models.CharField(max_length=160)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=RoundStatus.choices, default=RoundStatus.OPEN)

    class Meta:
        ordering = ["-starts_at"]

    def __str__(self) -> str:
        return f"{self.season} - {self.name}"


class CityScore(models.Model):
    round = models.ForeignKey(LeagueRound, on_delete=models.CASCADE, related_name="city_scores")
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="scores")
    points = models.FloatField(default=0)
    incidents_count = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["round", "city"], name="unique_score_per_round_city")
        ]
        ordering = ["position", "-points", "city__name"]

    def __str__(self) -> str:
        return f"{self.round} - {self.city}: {self.points:g}"

