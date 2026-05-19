from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from core.choices import IncidentCategory, IncidentStatus, RawArticleStatus
from league.models import City
from press.management.commands.process_articles import process_article
from press.models import Incident, Outlet, RawArticle
from press.services.dedupe import mark_duplicate_if_needed, title_similarity
from press.services.extractor import ExtractedIncident, parse_extraction_json, text_matches_keywords


class KeywordFilterTests(TestCase):
    def test_matches_spanish_and_catalan_keywords(self):
        self.assertTrue(text_matches_keywords("Apuñalamiento en una estación"))
        self.assertTrue(text_matches_keywords("Baralla amb ganivetada al metro"))

    def test_ignores_unrelated_text(self):
        self.assertFalse(text_matches_keywords("La previsión meteorológica mejora este fin de semana"))


class ExtractorValidationTests(TestCase):
    def test_parses_valid_fake_json(self):
        payload = """
        {
          "is_relevant": true,
          "category": "pelea",
          "city": "Barcelona",
          "neighborhood": null,
          "province": "Barcelona",
          "happened_at": null,
          "severity_1_5": 3,
          "confidence_0_1": 0.8,
          "is_duplicate_or_update": false,
          "mentions_police_confirmation": false,
          "mentions_other_media_as_source": false,
          "source_media_mentioned": null,
          "short_neutral_summary": "Pelea publicada por un medio local.",
          "scoring_notes": null
        }
        """
        result = parse_extraction_json(payload)
        self.assertIsInstance(result, ExtractedIncident)
        self.assertEqual(result.category, IncidentCategory.PELEA)

    def test_rejects_malformed_json(self):
        with self.assertRaises(ValueError):
            parse_extraction_json("{not-json")

    def test_rejects_invalid_category(self):
        payload = """
        {
          "is_relevant": true,
          "category": "politica",
          "city": "Barcelona",
          "neighborhood": null,
          "province": "Barcelona",
          "happened_at": null,
          "severity_1_5": 3,
          "confidence_0_1": 0.8,
          "is_duplicate_or_update": false,
          "mentions_police_confirmation": false,
          "mentions_other_media_as_source": false,
          "source_media_mentioned": null,
          "short_neutral_summary": "Resumen neutral.",
          "scoring_notes": null
        }
        """
        with self.assertRaises(ValueError):
            parse_extraction_json(payload)

    def test_rejects_invalid_severity_and_confidence_ranges(self):
        payload = """
        {
          "is_relevant": true,
          "category": "pelea",
          "city": "Barcelona",
          "neighborhood": null,
          "province": "Barcelona",
          "happened_at": null,
          "severity_1_5": 6,
          "confidence_0_1": 1.2,
          "is_duplicate_or_update": false,
          "mentions_police_confirmation": false,
          "mentions_other_media_as_source": false,
          "source_media_mentioned": null,
          "short_neutral_summary": "Resumen neutral.",
          "scoring_notes": null
        }
        """
        with self.assertRaises(ValueError):
            parse_extraction_json(payload)


class ProcessArticleTests(TestCase):
    def setUp(self):
        self.outlet = Outlet.objects.create(
            name="Diari Test",
            slug="diari-test",
            domain="example.com",
            homepage_url="https://example.com",
        )

    def make_article(self, **overrides):
        defaults = {
            "outlet": self.outlet,
            "url": "https://example.com/noticia",
            "headline": "Pelea en Barcelona",
            "excerpt": "Una pelea en una estacion del metro.",
            "raw_text": "Texto sobre una pelea en una estacion del metro de Barcelona.",
            "content_hash": "hash-test",
        }
        defaults.update(overrides)
        return RawArticle.objects.create(**defaults)

    def make_extraction(self, **overrides):
        defaults = {
            "is_relevant": True,
            "category": IncidentCategory.PELEA,
            "city": "Barcelona",
            "neighborhood": None,
            "province": "Barcelona",
            "happened_at": None,
            "severity_1_5": 3,
            "confidence_0_1": 0.8,
            "is_duplicate_or_update": False,
            "mentions_police_confirmation": False,
            "mentions_other_media_as_source": False,
            "source_media_mentioned": None,
            "short_neutral_summary": "Pelea registrada por un medio local.",
            "scoring_notes": "Confianza media por texto limitado.",
        }
        defaults.update(overrides)
        return ExtractedIncident.model_validate(defaults)

    def test_ignores_by_keywords_without_calling_ai(self):
        article = self.make_article(
            headline="Prevision meteorologica en Barcelona",
            excerpt="Sol durante el fin de semana.",
            raw_text="La prevision meteorologica mejora.",
        )

        with patch("press.management.commands.process_articles.extract_article") as extract_mock:
            result = process_article(article)

        self.assertEqual(result, "ignored")
        extract_mock.assert_not_called()
        article.refresh_from_db()
        self.assertEqual(article.status, RawArticleStatus.IGNORED)
        self.assertIsNone(article.ai_extraction)
        self.assertIsNone(article.ai_extracted_at)

    @patch("press.management.commands.process_articles.generate_headline_for_incident")
    @patch("press.management.commands.process_articles.extract_article")
    def test_saves_ai_extraction_and_creates_incident_when_relevant(self, extract_mock, headline_mock):
        article = self.make_article()
        extract_mock.return_value = self.make_extraction()

        result = process_article(article)

        self.assertEqual(result, "created")
        article.refresh_from_db()
        self.assertEqual(article.status, RawArticleStatus.PROCESSED)
        self.assertIsNotNone(article.ai_extraction)
        self.assertEqual(article.ai_extraction["category"], IncidentCategory.PELEA)
        self.assertIsNotNone(article.ai_extracted_at)
        incident = Incident.objects.get()
        self.assertEqual(incident.city.name, "Barcelona")
        self.assertEqual(incident.category, IncidentCategory.PELEA)
        self.assertEqual(incident.short_neutral_summary, "Pelea registrada por un medio local.")
        headline_mock.assert_called_once_with(incident)

    @patch("press.management.commands.process_articles.extract_article")
    def test_saves_ai_extraction_and_ignores_when_not_relevant(self, extract_mock):
        article = self.make_article()
        extract_mock.return_value = self.make_extraction(
            is_relevant=False,
            category=IncidentCategory.NO_RELEVANTE,
            city=None,
            province=None,
            severity_1_5=1,
            confidence_0_1=0.2,
            short_neutral_summary=None,
            scoring_notes="No es un suceso relevante.",
        )

        result = process_article(article)

        self.assertEqual(result, "ignored")
        article.refresh_from_db()
        self.assertEqual(article.status, RawArticleStatus.IGNORED)
        self.assertEqual(article.ai_extraction["category"], IncidentCategory.NO_RELEVANTE)
        self.assertIsNotNone(article.ai_extracted_at)
        self.assertFalse(Incident.objects.exists())

    @patch("press.management.commands.process_articles.extract_article")
    @patch("press.management.commands.process_articles.logger.exception")
    def test_command_marks_article_failed_when_ai_fails(self, logger_exception_mock, extract_mock):
        article = self.make_article()
        extract_mock.side_effect = RuntimeError("Ollama unavailable")

        call_command("process_articles", limit=1, stdout=StringIO())

        article.refresh_from_db()
        self.assertEqual(article.status, RawArticleStatus.FAILED)
        self.assertEqual(article.error_message, "Ollama unavailable")
        self.assertIsNone(article.ai_extraction)
        self.assertIsNone(article.ai_extracted_at)
        logger_exception_mock.assert_called_once()


class DedupeTests(TestCase):
    def test_marks_similar_same_city_category_as_duplicate(self):
        city = City.objects.create(name="Girona", slug="girona")
        original = Incident.objects.create(
            canonical_title="Pelea en el centro de Girona",
            city=city,
            category=IncidentCategory.PELEA,
            severity_1_5=3,
            confidence_0_1=0.9,
            status=IncidentStatus.APPROVED,
            points=7,
        )
        candidate = Incident.objects.create(
            canonical_title="Pelea en el centro de Girona",
            city=city,
            category=IncidentCategory.PELEA,
            severity_1_5=3,
            confidence_0_1=0.9,
            status=IncidentStatus.PENDING_REVIEW,
            points=7,
        )

        self.assertGreater(title_similarity(original.canonical_title, candidate.canonical_title), 0.82)
        self.assertTrue(mark_duplicate_if_needed(candidate))
        candidate.refresh_from_db()
        self.assertEqual(candidate.status, IncidentStatus.DUPLICATE)
        self.assertEqual(candidate.is_duplicate_of, original)
        self.assertEqual(candidate.points, 0)
