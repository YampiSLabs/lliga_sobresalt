from django.contrib import admin, messages

from core.choices import IncidentStatus, RawArticleStatus
from league.services.scoring import recalculate_incident_points
from press.models import Incident, IncidentSource, Outlet, RawArticle
from press.tasks import process_article_task, scrape_outlet_task
from satire.tasks import generate_headline_task


@admin.action(description="Scrape selected outlets now")
def scrape_selected_outlets_now(modeladmin, request, queryset):
    enqueued = skipped = errors = 0
    for outlet in queryset:
        if not outlet.is_active:
            skipped += 1
            continue
        try:
            scrape_outlet_task.delay(outlet.pk)
            enqueued += 1
        except Exception:
            errors += 1
    modeladmin.message_user(
        request,
        f"Scrape queued: enqueued={enqueued} skipped={skipped} errors={errors}",
        level=messages.WARNING if errors else messages.INFO,
    )


@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ("name", "domain", "is_active", "rss_url", "section_url", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "domain", "homepage_url", "rss_url", "section_url")
    prepopulated_fields = {"slug": ("name",)}
    actions = [scrape_selected_outlets_now]


@admin.action(description="Mark selected articles as ignored")
def mark_articles_ignored(modeladmin, request, queryset):
    queryset.update(status=RawArticleStatus.IGNORED)


@admin.action(description="Process selected articles with AI")
def process_selected_articles_with_ai(modeladmin, request, queryset):
    processable_statuses = {RawArticleStatus.NEW, RawArticleStatus.CANDIDATE, RawArticleStatus.FAILED}
    enqueued = skipped = errors = 0
    for article in queryset:
        if article.status not in processable_statuses:
            skipped += 1
            continue
        try:
            process_article_task.delay(article.pk)
            enqueued += 1
        except Exception:
            errors += 1
    modeladmin.message_user(
        request,
        f"AI processing queued: enqueued={enqueued} skipped={skipped} errors={errors}",
        level=messages.WARNING if errors else messages.INFO,
    )


@admin.register(RawArticle)
class RawArticleAdmin(admin.ModelAdmin):
    list_display = ("headline", "outlet", "status", "image_url", "published_at", "scraped_at", "ai_extracted_at")
    list_filter = ("status", "outlet", "scraped_at", "ai_extracted_at")
    search_fields = ("headline", "url", "excerpt")
    readonly_fields = ("scraped_at", "content_hash", "ai_extraction", "ai_extracted_at")
    actions = [mark_articles_ignored, process_selected_articles_with_ai]


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
    enqueued = errors = 0
    for incident in queryset:
        try:
            generate_headline_task.delay(incident.pk)
            enqueued += 1
        except Exception:
            errors += 1
    modeladmin.message_user(
        request,
        f"Headline generation queued: enqueued={enqueued} skipped=0 errors={errors}",
        level=messages.WARNING if errors else messages.INFO,
    )


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("canonical_title", "city", "category", "status", "points", "image_url", "confidence_0_1", "created_at")
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
