from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.conf import settings

from core.choices import IncidentCategory, IncidentStatus
from core.llm import chat_completion_json, get_llm_config
from league.models import City
from press.models import Incident

from core.llm import chat_completion_json, get_llm_config


class FrontendAssetTests(TestCase):
    def test_base_template_uses_local_compiled_css(self):
        response = self.client.get(reverse("core:home"))

        self.assertContains(response, "/static/css/app.css")
        self.assertNotContains(response, "cdn.tailwindcss.com")


class SecurityHeaderTests(TestCase):
    def test_public_pages_send_security_headers(self):
        response = self.client.get(reverse("core:home"))

        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["Referrer-Policy"], "same-origin")
        self.assertIn("geolocation=()", response.headers["Permissions-Policy"])


class PublicApiTests(TestCase):
    def make_incident(self, *, city_slug: str, category: str, title: str) -> Incident:
        city, _ = City.objects.get_or_create(
            slug=city_slug,
            defaults={"name": city_slug.title(), "province": "Barcelona"},
        )
        return Incident.objects.create(
            canonical_title=title,
            city=city,
            category=category,
            happened_at=timezone.now(),
            severity_1_5=3,
            confidence_0_1=0.8,
            points=8,
            status=IncidentStatus.APPROVED,
            short_neutral_summary=title,
        )

    def test_public_api_does_not_expose_raw_text(self):
        response = self.client.get(reverse("core:api_incidents"))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "raw_text")

    def test_incidents_api_filters_by_city_and_category(self):
        self.make_incident(
            city_slug="barcelona",
            category=IncidentCategory.PELEA,
            title="Pelea en Barcelona",
        )
        self.make_incident(
            city_slug="barcelona",
            category=IncidentCategory.ROBO_VIOLENTO,
            title="Robo en Barcelona",
        )
        self.make_incident(
            city_slug="badalona",
            category=IncidentCategory.PELEA,
            title="Pelea en Badalona",
        )

        response = self.client.get(
            reverse("core:api_incidents"),
            {"city": "barcelona", "category": IncidentCategory.PELEA},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["canonical_title"], "Pelea en Barcelona")

    def test_incidents_api_honors_limit(self):
        self.make_incident(
            city_slug="barcelona",
            category=IncidentCategory.PELEA,
            title="Primer incidente",
        )
        self.make_incident(
            city_slug="badalona",
            category=IncidentCategory.PELEA,
            title="Segundo incidente",
        )

        response = self.client.get(reverse("core:api_incidents"), {"limit": "1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)


class CeleryBeatScheduleTests(TestCase):
    def test_conservative_automation_schedule_is_configured(self):
        schedule = settings.CELERY_BEAT_SCHEDULE

        self.assertIn("scrape-press-hourly", schedule)
        self.assertIn("process-articles-every-30-minutes", schedule)
        self.assertIn("recalculate-rankings-hourly", schedule)
        self.assertEqual(schedule["scrape-press-hourly"]["task"], "scrape_press_task")
        self.assertEqual(schedule["process-articles-every-30-minutes"]["task"], "process_articles_task")
        self.assertEqual(schedule["process-articles-every-30-minutes"]["args"], (None,))
        self.assertEqual(schedule["recalculate-rankings-hourly"]["task"], "recalculate_rankings_task")


class LlmConfigTests(TestCase):
    @override_settings(
        OPENROUTER_API_KEY="test-key",
        OPENROUTER_BASE_URL="https://openrouter.ai/api/v1",
        OPENROUTER_MODEL="openrouter/free",
        OPENROUTER_TIMEOUT_SECONDS=60,
        OPENROUTER_SITE_URL="https://example.com",
        OPENROUTER_APP_NAME="La Lliga del Sobresalt",
    )
    def test_openrouter_config_wins_when_api_key_exists(self):
        config = get_llm_config()

        self.assertEqual(config["provider"], "openrouter")
        self.assertEqual(config["url"], "https://openrouter.ai/api/v1/chat/completions")
        self.assertEqual(config["model"], "openrouter/free")
        self.assertEqual(config["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(config["headers"]["HTTP-Referer"], "https://example.com")
        self.assertEqual(config["headers"]["X-Title"], "La Lliga del Sobresalt")

    @override_settings(
        OPENROUTER_API_KEY="",
        OLLAMA_BASE_URL="http://localhost:11434/v1",
        OLLAMA_MODEL="qwen3:4b",
        OLLAMA_TIMEOUT_SECONDS=60,
    )
    def test_ollama_config_is_fallback_without_openrouter_key(self):
        config = get_llm_config()

        self.assertEqual(config["provider"], "ollama")
        self.assertEqual(config["url"], "http://localhost:11434/v1/chat/completions")
        self.assertEqual(config["model"], "qwen3:4b")
        self.assertEqual(config["headers"], {})

    @override_settings(
        OPENROUTER_API_KEY="test-key",
        OPENROUTER_BASE_URL="https://openrouter.ai/api/v1",
        OPENROUTER_MODEL="openrouter/free",
        OPENROUTER_TIMEOUT_SECONDS=60,
        OPENROUTER_SITE_URL="",
        OPENROUTER_APP_NAME="La Lliga del Sobresalt",
    )
    @patch("core.llm.httpx.Client")
    def test_chat_completion_uses_openrouter_free_model(self, client_class):
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": '{"ok":true}'}}]}
        client = client_class.return_value.__enter__.return_value
        client.post.return_value = response

        result = chat_completion_json(
            [{"role": "user", "content": "Devuelve JSON"}],
            temperature=0,
            purpose="test",
            retries=0,
        )

        self.assertEqual(result, '{"ok":true}')
        client.post.assert_called_once()
        _, kwargs = client.post.call_args
        self.assertEqual(kwargs["json"]["model"], "openrouter/free")
        self.assertEqual(kwargs["json"]["response_format"], {"type": "json_object"})
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")


class SeasonsApiTests(TestCase):
    def setUp(self):
        from league.models import City, LeagueSeason, LeagueRound, CityScore
        from core.choices import RoundStatus

        self.city_bcn = City.objects.create(name="Barcelona", slug="barcelona", province="Barcelona")
        self.city_bad = City.objects.create(name="Badalona", slug="badalona", province="Barcelona")

        # Create a season and round
        self.season = LeagueSeason.objects.create(name="Temporada 2025/2026")
        self.round_1 = LeagueRound.objects.create(
            season=self.season,
            name="Jornada 1",
            starts_at=timezone.now(),
            ends_at=timezone.now(),
            status=RoundStatus.CLOSED,
        )

        # Create scores
        CityScore.objects.create(round=self.round_1, city=self.city_bcn, points=10, incidents_count=1, position=1)
        CityScore.objects.create(round=self.round_1, city=self.city_bad, points=5, incidents_count=1, position=2)

    def test_api_seasons_returns_list_with_podiums_and_winner(self):
        response = self.client.get(reverse("core:api_seasons"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)

        season_data = data[0]
        self.assertEqual(season_data["name"], "Temporada 2025/2026")
        self.assertEqual(season_data["status"], "Finalitzada")
        self.assertEqual(season_data["winner"]["name"], "Barcelona")
        self.assertEqual(len(season_data["podium"]), 2)
        self.assertEqual(season_data["podium"][0]["name"], "Barcelona")
        self.assertEqual(season_data["podium"][0]["points"], 10.0)
        self.assertEqual(season_data["podium"][1]["name"], "Badalona")
        self.assertEqual(season_data["podium"][1]["points"], 5.0)


class IncidentsAdvancedApiTests(TestCase):
    def setUp(self):
        from league.models import City
        from press.models import Incident

        self.city = City.objects.create(name="Barcelona", slug="barcelona", province="Barcelona")
        self.inc_1 = Incident.objects.create(
            canonical_title="Apuñalamiento grave en metro",
            city=self.city,
            category=IncidentCategory.APUNYALAMENT,
            happened_at=timezone.now(),
            severity_1_5=4,
            confidence_0_1=0.9,
            points=12,
            status=IncidentStatus.APPROVED,
            short_neutral_summary="Suceso en el metro.",
        )
        self.inc_2 = Incident.objects.create(
            canonical_title="Pelea callejera sin armas",
            city=self.city,
            category=IncidentCategory.PELEA,
            happened_at=timezone.now(),
            severity_1_5=2,
            confidence_0_1=0.8,
            points=4,
            status=IncidentStatus.APPROVED,
            short_neutral_summary="Pelea en la vía pública.",
        )

    def test_api_incidents_search_by_title_or_summary(self):
        # Search for 'Apuñalamiento'
        response = self.client.get(reverse("core:api_incidents"), {"q": "apuñalamiento"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["canonical_title"], "Apuñalamiento grave en metro")

        # Search for 'vía pública'
        response = self.client.get(reverse("core:api_incidents"), {"q": "vía pública"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["canonical_title"], "Pelea callejera sin armas")

    def test_api_incidents_filter_by_severity(self):
        response = self.client.get(reverse("core:api_incidents"), {"severity_min": "3"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["canonical_title"], "Apuñalamiento grave en metro")

    def test_api_incidents_filter_by_multiple_categories(self):
        response = self.client.get(reverse("core:api_incidents"), {"category": "apunyalament,pelea"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

    def test_api_incidents_sort_by_points(self):
        # Points ascending
        response = self.client.get(reverse("core:api_incidents"), {"sort": "points_asc"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data[0]["canonical_title"], "Pelea callejera sin armas")

        # Points descending
        response = self.client.get(reverse("core:api_incidents"), {"sort": "points_desc"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data[0]["canonical_title"], "Apuñalamiento grave en metro")
