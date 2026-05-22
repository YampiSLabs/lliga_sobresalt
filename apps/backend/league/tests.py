from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from core.choices import IncidentCategory, IncidentStatus
from press.models import Incident
from league.models import City
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
