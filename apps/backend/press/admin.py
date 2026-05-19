from django.contrib import admin

from core.choices import IncidentStatus, RawArticleStatus
from league.services.scoring import recalculate_incident_points
from press.models import Incident, IncidentSource, Outlet, RawArticle
from satire.services.headlines import generate_headline_for_incident


@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ("name", "domain", "is_active", "rss_url", "section_url", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "domain", "homepage_url", "rss_url", "section_url")
    prepopulated_fields = {"slug": ("name",)}


@admin.action(description="Mark selected articles as ignored")
def mark_articles_ignored(modeladmin, request, queryset):
    queryset.update(status=RawArticleStatus.IGNORED)


@admin.register(RawArticle)
class RawArticleAdmin(admin.ModelAdmin):
    list_display = ("headline", "outlet", "status", "published_at", "scraped_at", "ai_extracted_at")
    list_filter = ("status", "outlet", "scraped_at", "ai_extracted_at")
    search_fields = ("headline", "url", "excerpt")
    readonly_fields = ("scraped_at", "content_hash", "ai_extraction", "ai_extracted_at")
    actions = [mark_articles_ignored]


class IncidentSourceInline(admin.TabularInline):
    model = IncidentSource
    extra = 0
    autocomplete_fields = ("article",)


@admin.action(description="Approve selected incidents")
def approve_incidents(modeladmin, request, queryset):
    queryset.update(status=IncidentStatus.APPROVED)


@admin.action(description="Reject selected incidents")
def reject_incidents(modeladmin, request, queryset):
    queryset.update(status=IncidentStatus.REJECTED)


@admin.action(description="Recalculate points")
def recalculate_points(modeladmin, request, queryset):
    for incident in queryset:
        recalculate_incident_points(incident)


@admin.action(description="Generate satirical headline drafts")
def generate_satirical_headlines(modeladmin, request, queryset):
    for incident in queryset:
        generate_headline_for_incident(incident)


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("canonical_title", "city", "category", "status", "points", "confidence_0_1", "created_at")
    list_filter = ("status", "category", "city", "mentions_police_confirmation", "mentions_other_media_as_source")
    search_fields = ("canonical_title", "short_neutral_summary", "sources__article__headline", "sources__article__url")
    autocomplete_fields = ("city", "is_duplicate_of")
    readonly_fields = ("created_at", "updated_at")
    inlines = [IncidentSourceInline]
    actions = [approve_incidents, reject_incidents, recalculate_points, generate_satirical_headlines]


@admin.register(IncidentSource)
class IncidentSourceAdmin(admin.ModelAdmin):
    list_display = ("incident", "article", "is_primary", "created_at")
    list_filter = ("is_primary", "created_at")
    search_fields = ("incident__canonical_title", "article__headline", "article__url")
    autocomplete_fields = ("incident", "article")
