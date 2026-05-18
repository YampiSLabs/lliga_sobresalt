from django.test import TestCase

from core.choices import IncidentCategory, IncidentStatus
from league.models import City
from press.models import Incident
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

