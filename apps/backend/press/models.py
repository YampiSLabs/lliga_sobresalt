from django.db import models
from django.utils import timezone

from core.choices import IncidentCategory, IncidentStatus, RawArticleStatus


class Outlet(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    domain = models.CharField(max_length=255)
    homepage_url = models.URLField(max_length=1000)
    rss_url = models.URLField(max_length=1000, blank=True, null=True)
    section_url = models.URLField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class RawArticle(models.Model):
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name="raw_articles")
    url = models.URLField(max_length=1000, unique=True)
    headline = models.CharField(max_length=500)
    excerpt = models.TextField(blank=True, null=True)
    raw_text = models.TextField(blank=True, null=True)
    published_at = models.DateTimeField(blank=True, null=True)
    scraped_at = models.DateTimeField(default=timezone.now)
    content_hash = models.CharField(max_length=64, db_index=True)
    ai_extraction = models.JSONField(blank=True, null=True)
    ai_extracted_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=RawArticleStatus.choices,
        default=RawArticleStatus.NEW,
        db_index=True,
    )
    image_url = models.CharField(max_length=1000, blank=True, null=True)
    thumbnail_url = models.CharField(max_length=1000, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-scraped_at"]
        indexes = [models.Index(fields=["status", "scraped_at"])]

    def __str__(self) -> str:
        return self.headline


class Incident(models.Model):
    canonical_title = models.CharField(max_length=500)
    city = models.ForeignKey(
        "league.City",
        on_delete=models.SET_NULL,
        related_name="incidents",
        blank=True,
        null=True,
    )
    neighborhood = models.CharField(max_length=160, blank=True, null=True)
    province = models.CharField(max_length=120, blank=True, null=True)
    category = models.CharField(max_length=40, choices=IncidentCategory.choices)
    happened_at = models.DateTimeField(blank=True, null=True)
    severity_1_5 = models.PositiveSmallIntegerField(default=1)
    confidence_0_1 = models.FloatField(default=0)
    points = models.FloatField(default=0)
    status = models.CharField(
        max_length=20,
        choices=IncidentStatus.choices,
        default=IncidentStatus.DRAFT,
        db_index=True,
    )
    is_duplicate_of = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="duplicates",
        blank=True,
        null=True,
    )
    short_neutral_summary = models.TextField(blank=True, null=True)
    scoring_notes = models.TextField(blank=True, null=True)
    mentions_police_confirmation = models.BooleanField(default=False)
    mentions_other_media_as_source = models.BooleanField(default=False)
    source_media_mentioned = models.CharField(max_length=255, blank=True, null=True)
    image_url = models.CharField(max_length=1000, blank=True, null=True)
    thumbnail_url = models.CharField(max_length=1000, blank=True, null=True)
    image_disclaimer = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "category"]),
            models.Index(fields=["city", "category"]),
        ]

    def __str__(self) -> str:
        return self.canonical_title


class IncidentSource(models.Model):
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="sources")
    article = models.ForeignKey(RawArticle, on_delete=models.CASCADE, related_name="incident_sources")
    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["incident", "article"], name="unique_incident_article")
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.incident} <- {self.article}"
