from django.contrib import admin

from satire.models import SatiricalHeadline


@admin.register(SatiricalHeadline)
class SatiricalHeadlineAdmin(admin.ModelAdmin):
    list_display = ("text", "incident", "tone", "risk_level", "approved", "created_at")
    list_filter = ("approved", "tone", "risk_level", "created_at")
    search_fields = ("text", "incident__canonical_title", "why_safe")
    autocomplete_fields = ("incident",)

