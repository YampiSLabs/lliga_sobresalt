from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from core.choices import IncidentCategory, IncidentStatus, RoundStatus
from press.models import Incident
from league.models import City, CityScore, LeagueRound, LeagueSeason
from league.services.ranking import recalculate_all_rounds
from league.services.scoring import calculate_points


class ScoringTests(TestCase):
    def test_calculates_points_from_code_rules(self):
        incident = Incident(
            canonical_title="Robatori violent publicat per premsa",
            category=IncidentCategory.ROBO_VIOLENTO,
            severity_1_5=4,
            confidence_0_1=0.8,
            status=IncidentStatus.PENDING_REVIEW,
        )

        self.assertEqual(calculate_points(incident), 7.0)

    def test_transport_gets_bonus(self):
        incident = Incident(
            canonical_title="Incident al metro",
            category=IncidentCategory.TRANSPORTE_PUBLICO,
            severity_1_5=3,
            confidence_0_1=0.8,
            status=IncidentStatus.PENDING_REVIEW,
        )

        self.assertEqual(calculate_points(incident), 7.0)

    def test_duplicate_scores_zero(self):
        incident = Incident(
            canonical_title="Duplicate",
            category=IncidentCategory.HOMICIDIO,
            severity_1_5=5,
            confidence_0_1=1,
            status=IncidentStatus.DUPLICATE,
        )

        self.assertEqual(calculate_points(incident), 0)


class SyncShieldCitiesCommandTests(TestCase):
    def test_creates_active_city_from_shield_manifest(self):
        stdout = StringIO()

        call_command("sync_shield_cities", "--apply", stdout=stdout)

        mataro = City.objects.get(slug="mataro")
        self.assertEqual(mataro.name, "Mataró")

        city = City.objects.get(slug="sabadell")
        self.assertEqual(city.name, "Sabadell")
        self.assertEqual(city.province, "Barcelona")
        self.assertTrue(city.is_active)
        self.assertIn("created=", stdout.getvalue())

    def test_merges_manifest_aliases_without_removing_existing_aliases(self):
        City.objects.create(
            name="Hospitalet manual",
            slug="lhospitalet",
            province="Barcelona",
            aliases=["manual-alias"],
            is_active=False,
        )

        call_command("sync_shield_cities", "--apply")

        city = City.objects.get(slug="lhospitalet")
        self.assertEqual(city.name, "L'Hospitalet de Llobregat")
        self.assertTrue(city.is_active)
        self.assertIn("manual-alias", city.aliases)
        self.assertIn("l-hospitalet-de-llobregat", city.aliases)
        self.assertIn("lhospitalet-de-llobregat", city.aliases)
        self.assertEqual(City.objects.filter(name="L'Hospitalet de Llobregat").count(), 1)

    def test_seed_league_uses_generated_shield_manifest(self):
        call_command("seed_league", "--clear")

        self.assertTrue(City.objects.filter(slug="sabadell", is_active=True).exists())


class RankingRecalculationTests(TestCase):
    def setUp(self):
        self.city_bcn = City.objects.create(name="Barcelona", slug="barcelona", province="Barcelona")
        self.city_girona = City.objects.create(name="Girona", slug="girona", province="Girona")
        self.season = LeagueSeason.objects.create(name="Temporada 2026", is_active=True)
        now = timezone.now()
        self.closed_round = LeagueRound.objects.create(
            season=self.season,
            name="Jornada 1",
            starts_at=now - timezone.timedelta(days=14),
            ends_at=now - timezone.timedelta(days=7),
            status=RoundStatus.CLOSED,
        )
        self.open_round = LeagueRound.objects.create(
            season=self.season,
            name="Jornada 2",
            starts_at=now - timezone.timedelta(days=1),
            ends_at=now + timezone.timedelta(days=6),
            status=RoundStatus.OPEN,
        )
        Incident.objects.create(
            canonical_title="Incident aprovat a jornada tancada",
            city=self.city_girona,
            category=IncidentCategory.PELEA,
            points=8,
            status=IncidentStatus.APPROVED,
            happened_at=now - timezone.timedelta(days=10),
        )
        Incident.objects.create(
            canonical_title="Incident aprovat a jornada oberta",
            city=self.city_bcn,
            category=IncidentCategory.APUNYALAMENT,
            points=12,
            status=IncidentStatus.APPROVED,
            happened_at=now,
        )

    def test_recalculate_all_rounds_populates_closed_and_open_round_rankings(self):
        created = recalculate_all_rounds()

        self.assertEqual(created, 2)
        self.assertTrue(CityScore.objects.filter(round=self.closed_round, city=self.city_girona).exists())
        self.assertTrue(CityScore.objects.filter(round=self.open_round, city=self.city_bcn).exists())
