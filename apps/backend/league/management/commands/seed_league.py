import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.utils.text import slugify

from league.models import City, ScoringRule, LeagueSeason, LeagueRound
from press.models import Outlet
from core.choices import IncidentCategory, RoundStatus
from league.services.scoring import DEFAULT_BASE_POINTS


class Command(BaseCommand):
    help = "Seed the database with the 11 active Catalan cities, scoring rules, and a default season/round."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing data before seeding",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write("Clearing existing league and press data...")
            LeagueRound.objects.all().delete()
            LeagueSeason.objects.all().delete()
            City.objects.all().delete()
            ScoringRule.objects.all().delete()
            Outlet.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Existing data cleared."))

        # 1. Seed Active Cities
        # We seed exactly the 11 cities with image/shield assets in the frontend
        cities_data = [
            {"name": "Barcelona", "slug": "barcelona", "province": "Barcelona", "aliases": []},
            {"name": "Badalona", "slug": "badalona", "province": "Barcelona", "aliases": []},
            {"name": "Girona", "slug": "girona", "province": "Girona", "aliases": []},
            {"name": "Reus", "slug": "reus", "province": "Tarragona", "aliases": []},
            {"name": "Tarragona", "slug": "tarragona", "province": "Tarragona", "aliases": []},
            {"name": "Terrassa", "slug": "terrassa", "province": "Barcelona", "aliases": []},
            {"name": "Mataró", "slug": "mataro", "province": "Barcelona", "aliases": []},
            {
                "name": "L'Hospitalet de Llobregat",
                "slug": "lhospitalet",
                "province": "Barcelona",
                "aliases": ["l-hospitalet-de-llobregat", "lhospitalet-de-llobregat"],
            },
            {
                "name": "Cornellà de Llobregat",
                "slug": "cornella-de-llobregat",
                "province": "Barcelona",
                "aliases": ["cornella"],
            },
            {
                "name": "Santa Coloma de Gramenet",
                "slug": "santa-coloma-de-gramenet",
                "province": "Barcelona",
                "aliases": ["santa-coloma"],
            },
            {"name": "Lleida", "slug": "lleida", "province": "Lleida", "aliases": []},
        ]

        self.stdout.write("Seeding active cities...")
        for city_item in cities_data:
            city, created = City.objects.update_or_create(
                slug=city_item["slug"],
                defaults={
                    "name": city_item["name"],
                    "province": city_item["province"],
                    "aliases": city_item["aliases"],
                    "is_active": True,
                },
            )
            status_str = "created" if created else "updated"
            self.stdout.write(f"  City '{city.name}' {status_str}.")

        # 2. Seed Default Scoring Rules
        self.stdout.write("Seeding scoring rules...")
        for category, base_points in DEFAULT_BASE_POINTS.items():
            rule, created = ScoringRule.objects.update_or_create(
                category=category,
                defaults={
                    "base_points": base_points,
                    "is_active": True,
                    "notes": f"Regla bàsica per a {category}",
                },
            )
            status_str = "created" if created else "updated"
            self.stdout.write(f"  ScoringRule '{category}' ({base_points} pts) {status_str}.")

        # 3. Seed Outlets (Whitelisted press sources)
        self.stdout.write("Seeding whitelisted press outlets...")
        outlets_data = [
            {
                "name": "El Caso",
                "slug": "el-caso",
                "domain": "elcaso.elnacional.cat",
                "homepage_url": "https://elcaso.elnacional.cat",
                "rss_url": "https://elcaso.elnacional.cat/ca/rss",
                "section_url": "https://elcaso.elnacional.cat/",
            },
            {
                "name": "El Nacional",
                "slug": "el-nacional",
                "domain": "elnacional.cat",
                "homepage_url": "https://www.elnacional.cat",
                "rss_url": "https://www.elnacional.cat/ca/rss",
                "section_url": "https://www.elnacional.cat/",
            },
            {
                "name": "Diari Ara",
                "slug": "ara",
                "domain": "ara.cat",
                "homepage_url": "https://www.ara.cat",
                "rss_url": "https://www.ara.cat/rss",
                "section_url": None,
            },
        ]
        for o_item in outlets_data:
            outlet, created = Outlet.objects.update_or_create(
                slug=o_item["slug"],
                defaults={
                    "name": o_item["name"],
                    "domain": o_item["domain"],
                    "homepage_url": o_item["homepage_url"],
                    "rss_url": o_item["rss_url"],
                    "section_url": o_item["section_url"],
                    "is_active": True,
                },
            )
            status_str = "created" if created else "updated"
            self.stdout.write(f"  Outlet '{outlet.name}' {status_str}.")

        # 4. Seed Season and Rounds
        self.stdout.write("Seeding default season and rounds...")
        now = timezone.now()
        season, created = LeagueSeason.objects.update_or_create(
            name="Temporada 2026",
            defaults={
                "starts_at": now - datetime.timedelta(days=15),
                "is_active": True,
            },
        )
        season_status = "created" if created else "updated"
        self.stdout.write(f"  Season '{season.name}' {season_status}.")

        # Seed 3 Rounds: Round 1 (Completed), Round 2 (Completed), Round 3 (Active/Open)
        rounds_info = [
            {
                "name": "Jornada 1",
                "starts_at": now - datetime.timedelta(days=14),
                "ends_at": now - datetime.timedelta(days=8),
                "status": RoundStatus.CLOSED,
            },
            {
                "name": "Jornada 2",
                "starts_at": now - datetime.timedelta(days=7),
                "ends_at": now - datetime.timedelta(days=1),
                "status": RoundStatus.CLOSED,
            },
            {
                "name": "Jornada 3",
                "starts_at": now - datetime.timedelta(days=0),
                "ends_at": now + datetime.timedelta(days=6),
                "status": RoundStatus.OPEN,
            },
        ]

        for r_info in rounds_info:
            rnd, created = LeagueRound.objects.update_or_create(
                season=season,
                name=r_info["name"],
                defaults={
                    "starts_at": r_info["starts_at"],
                    "ends_at": r_info["ends_at"],
                    "status": r_info["status"],
                },
            )
            r_status = "created" if created else "updated"
            self.stdout.write(f"    Round '{rnd.name}' {r_status} with status {rnd.status}.")

        self.stdout.write(self.style.SUCCESS("Database seeded successfully with active settings!"))
