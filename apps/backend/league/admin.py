from django.contrib import admin

from league.models import City, CityScore, LeagueRound, LeagueSeason, ScoringRule


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "province", "is_active")
    list_filter = ("is_active", "province")
    search_fields = ("name", "slug", "province", "aliases")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ScoringRule)
class ScoringRuleAdmin(admin.ModelAdmin):
    list_display = ("category", "base_points", "is_active")
    list_filter = ("is_active", "category")
    search_fields = ("category", "notes")


class LeagueRoundInline(admin.TabularInline):
    model = LeagueRound
    extra = 0


@admin.register(LeagueSeason)
class LeagueSeasonAdmin(admin.ModelAdmin):
    list_display = ("name", "starts_at", "ends_at", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
    inlines = [LeagueRoundInline]


@admin.register(LeagueRound)
class LeagueRoundAdmin(admin.ModelAdmin):
    list_display = ("name", "season", "starts_at", "ends_at", "status")
    list_filter = ("status", "season")
    search_fields = ("name", "season__name")


@admin.register(CityScore)
class CityScoreAdmin(admin.ModelAdmin):
    list_display = ("position", "city", "round", "points", "incidents_count", "updated_at")
    list_filter = ("round",)
    search_fields = ("city__name", "round__name")

