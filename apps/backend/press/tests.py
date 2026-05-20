from io import StringIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from core.choices import IncidentCategory, IncidentStatus, RawArticleStatus
from league.models import City
from press.admin import (
    generate_satirical_headlines,
    process_selected_articles_with_ai,
    scrape_selected_outlets_now,
)
from press.management.commands.process_articles import process_article
from press.models import Incident, Outlet, RawArticle
from press.services.dedupe import mark_duplicate_if_needed, title_similarity
from press.services.extractor import ExtractedIncident, parse_extraction_json, text_matches_keywords
from press.services.scraper import (
    ScrapedArticle,
    content_hash_for,
    extract_internal_links,
    is_probable_article_url,
    parse_feed_date,
    scrape_outlet,
    scrape_rss,
    scrape_section,
)


class KeywordFilterTests(TestCase):
    def test_matches_spanish_and_catalan_keywords(self):
        self.assertTrue(text_matches_keywords("Apuñalamiento en una estación"))
        self.assertTrue(text_matches_keywords("Baralla amb ganivetada al metro"))
        self.assertTrue(text_matches_keywords("Incident en una estacio de metro"))

    def test_ignores_unrelated_text(self):
        self.assertFalse(text_matches_keywords("La previsión meteorológica mejora este fin de semana"))


    def test_ignores_station_words_outside_transport_context(self):
        self.assertFalse(text_matches_keywords("Estacio depuradora d'aigues residuals"))
        self.assertFalse(text_matches_keywords("Sortida reivindicativa per reclamar la reconstruccio"))


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
          "short_neutral_summary_ca": "Pelea publicada por un medio local.",
          "short_neutral_summary_es": "Pelea publicada por un medio local.",
          "short_neutral_summary_en": "Fight published by a local media.",
          "scoring_notes_ca": null,
          "scoring_notes_es": null,
          "scoring_notes_en": null
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
          "short_neutral_summary_ca": "Resumen neutral.",
          "short_neutral_summary_es": "Resumen neutral.",
          "short_neutral_summary_en": "Neutral summary.",
          "scoring_notes_ca": null,
          "scoring_notes_es": null,
          "scoring_notes_en": null
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
          "short_neutral_summary_ca": "Resumen neutral.",
          "short_neutral_summary_es": "Resumen neutral.",
          "short_neutral_summary_en": "Neutral summary.",
          "scoring_notes_ca": null,
          "scoring_notes_es": null,
          "scoring_notes_en": null
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
        City.objects.create(
            name="Barcelona",
            slug="barcelona",
            province="Barcelona",
            is_active=True,
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
            "short_neutral_summary_ca": "Pelea registrada por un medio local.",
            "short_neutral_summary_es": "Pelea registrada por un medio local.",
            "short_neutral_summary_en": "Fight registered by a local media.",
            "scoring_notes_ca": "Confianza media por texto limitado.",
            "scoring_notes_es": "Confianza media por texto limitado.",
            "scoring_notes_en": "Medium confidence due to limited text.",
        }

        # Handle overrides that might pass old keys (short_neutral_summary / scoring_notes)
        if "short_neutral_summary" in overrides:
            val = overrides.pop("short_neutral_summary")
            defaults["short_neutral_summary_ca"] = val
            defaults["short_neutral_summary_es"] = val
            defaults["short_neutral_summary_en"] = val
        if "scoring_notes" in overrides:
            val = overrides.pop("scoring_notes")
            defaults["scoring_notes_ca"] = val
            defaults["scoring_notes_es"] = val
            defaults["scoring_notes_en"] = val

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

    @patch("press.management.commands.process_articles.generate_headline_for_incident")
    @patch("press.management.commands.process_articles.extract_article")
    def test_reprocesses_failed_article(self, extract_mock, headline_mock):
        article = self.make_article(status=RawArticleStatus.FAILED, error_message="Previous error")
        extract_mock.return_value = self.make_extraction()

        result = process_article(article)

        self.assertEqual(result, "created")
        article.refresh_from_db()
        self.assertEqual(article.status, RawArticleStatus.PROCESSED)
        self.assertIsNone(article.error_message)
        headline_mock.assert_called_once()

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


class AdminActionTests(TestCase):
    def setUp(self):
        self.modeladmin = MagicMock()
        self.request = MagicMock()
        self.outlet = Outlet.objects.create(
            name="Diari Test",
            slug="diari-test",
            domain="example.com",
            homepage_url="https://example.com",
        )

    def make_article(self, status: str) -> RawArticle:
        return RawArticle.objects.create(
            outlet=self.outlet,
            url=f"https://example.com/{status}",
            headline=f"Article {status}",
            content_hash=f"hash-{status}",
            status=status,
        )

    def make_incident(self) -> Incident:
        return Incident.objects.create(
            canonical_title="Pelea en Barcelona",
            category=IncidentCategory.PELEA,
            severity_1_5=3,
            confidence_0_1=0.8,
            status=IncidentStatus.PENDING_REVIEW,
        )

    @patch("press.admin.scrape_outlet_task.delay")
    def test_outlet_admin_action_enqueues_active_outlets(self, delay_mock):
        inactive = Outlet.objects.create(
            name="Inactive",
            slug="inactive",
            domain="inactive.example.com",
            homepage_url="https://inactive.example.com",
            is_active=False,
        )

        scrape_selected_outlets_now(self.modeladmin, self.request, Outlet.objects.filter(pk__in=[self.outlet.pk, inactive.pk]))

        delay_mock.assert_called_once_with(self.outlet.pk)
        self.modeladmin.message_user.assert_called_once()

    @patch("press.admin.process_article_task.delay")
    def test_raw_article_admin_action_enqueues_only_processable_articles(self, delay_mock):
        processable = self.make_article(RawArticleStatus.NEW)
        failed = self.make_article(RawArticleStatus.FAILED)
        processed = self.make_article(RawArticleStatus.PROCESSED)

        process_selected_articles_with_ai(
            self.modeladmin,
            self.request,
            RawArticle.objects.filter(pk__in=[processable.pk, failed.pk, processed.pk]),
        )

        self.assertEqual(delay_mock.call_count, 2)
        delay_mock.assert_any_call(processable.pk)
        delay_mock.assert_any_call(failed.pk)
        self.modeladmin.message_user.assert_called_once()

    @patch("press.admin.generate_headline_task.delay")
    def test_incident_admin_action_enqueues_headline_generation(self, delay_mock):
        incident = self.make_incident()

        generate_satirical_headlines(self.modeladmin, self.request, Incident.objects.filter(pk=incident.pk))

        delay_mock.assert_called_once_with(incident.pk)
        self.modeladmin.message_user.assert_called_once()


class ScrapeCommandTests(TestCase):
    def setUp(self):
        self.outlet = Outlet.objects.create(
            name="Diari Test",
            slug="diari-test",
            domain="example.com",
            homepage_url="https://example.com",
        )

    @patch("press.management.commands.scrape_press.scrape_outlet")
    def test_scrape_press_can_target_one_outlet(self, scrape_outlet_mock):
        scrape_outlet_mock.return_value = 3

        call_command("scrape_press", outlet="diari-test", stdout=StringIO())

        scrape_outlet_mock.assert_called_once_with(self.outlet)


class ScraperServiceTests(TestCase):
    def setUp(self):
        self.outlet = Outlet.objects.create(
            name="Diari Test",
            slug="diari-test",
            domain="example.com",
            homepage_url="https://example.com",
            rss_url="https://example.com/rss",
        )

    @patch("press.services.scraper.scrape_rss")
    def test_scrape_outlet_creates_new_articles_from_rss(self, scrape_rss_mock):
        scrape_rss_mock.return_value = [
            ScrapedArticle(
                url="https://example.com/news/1",
                headline="Pelea en Barcelona",
                excerpt="Resumen",
                raw_text="Texto",
                published_at=timezone.now(),
            )
        ]

        created = scrape_outlet(self.outlet)

        self.assertEqual(created, 1)
        article = RawArticle.objects.get(url="https://example.com/news/1")
        self.assertEqual(article.status, RawArticleStatus.NEW)
        self.assertEqual(article.headline, "Pelea en Barcelona")
        self.assertEqual(article.outlet, self.outlet)

    @patch("press.services.scraper.scrape_rss")
    def test_scrape_outlet_skips_existing_urls(self, scrape_rss_mock):
        RawArticle.objects.create(
            outlet=self.outlet,
            url="https://example.com/news/1",
            headline="Existing",
            content_hash="existing-hash",
            status=RawArticleStatus.NEW,
        )
        scrape_rss_mock.return_value = [
            ScrapedArticle(url="https://example.com/news/1", headline="Pelea en Barcelona")
        ]

        created = scrape_outlet(self.outlet)

        self.assertEqual(created, 0)
        self.assertEqual(RawArticle.objects.count(), 1)

    @patch("press.services.scraper.scrape_rss")
    def test_scrape_outlet_marks_non_keyword_articles_as_ignored(self, scrape_rss_mock):
        scrape_rss_mock.return_value = [
            ScrapedArticle(
                url="https://example.com/news/culture",
                headline="Concert a Girona",
                excerpt="Agenda cultural del cap de setmana",
                raw_text="La programacio cultural suma nous concerts.",
            )
        ]

        created = scrape_outlet(self.outlet)

        self.assertEqual(created, 1)
        article = RawArticle.objects.get(url="https://example.com/news/culture")
        self.assertEqual(article.status, RawArticleStatus.IGNORED)

    @patch("press.services.scraper.scrape_rss")
    def test_scrape_outlet_does_not_use_raw_text_for_initial_keyword_status(self, scrape_rss_mock):
        scrape_rss_mock.return_value = [
            ScrapedArticle(
                url="https://example.com/news/related-noise",
                headline="Concert a Girona",
                excerpt="Agenda cultural del cap de setmana",
                raw_text="Noticia cultural. Enlaces relacionados: pelea, apunalamiento, robo.",
            )
        ]

        created = scrape_outlet(self.outlet)

        self.assertEqual(created, 1)
        article = RawArticle.objects.get(url="https://example.com/news/related-noise")
        self.assertEqual(article.status, RawArticleStatus.IGNORED)

    @patch("press.services.scraper.scrape_rss")
    def test_scrape_outlet_marks_duplicate_content_as_ignored(self, scrape_rss_mock):
        duplicate_hash = content_hash_for("Same headline", "Same excerpt", "Same text")
        RawArticle.objects.create(
            outlet=self.outlet,
            url="https://example.com/news/original",
            headline="Same headline",
            excerpt="Same excerpt",
            raw_text="Same text",
            content_hash=duplicate_hash,
            status=RawArticleStatus.NEW,
        )
        scrape_rss_mock.return_value = [
            ScrapedArticle(
                url="https://example.com/news/copy",
                headline="Same headline",
                excerpt="Same excerpt",
                raw_text="Same text",
            )
        ]

        created = scrape_outlet(self.outlet)

        self.assertEqual(created, 1)
        article = RawArticle.objects.get(url="https://example.com/news/copy")
        self.assertEqual(article.status, RawArticleStatus.IGNORED)

    @patch("press.services.scraper.extract_text_and_image_from_url")
    @patch("press.services.scraper.feedparser.parse")
    def test_scrape_rss_reads_feed_entries_and_extracts_text(self, parse_mock, extract_mock):
        parse_mock.return_value = SimpleNamespace(
            entries=[
                SimpleNamespace(
                    link="https://example.com/news/1",
                    title="Pelea en Barcelona",
                    summary="Resumen",
                    published="Tue, 19 May 2026 10:30:00 +0200",
                ),
                SimpleNamespace(link="", title="Missing URL"),
                SimpleNamespace(link="https://example.com/news/2", title=""),
            ]
        )
        extract_mock.return_value = ("Texto extraido", "https://example.com/image.jpg")

        articles = scrape_rss("https://example.com/rss")

        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0].url, "https://example.com/news/1")
        self.assertEqual(articles[0].raw_text, "Texto extraido")
        self.assertEqual(articles[0].image_url, "https://example.com/image.jpg")
        self.assertIsNotNone(articles[0].published_at)
        extract_mock.assert_called_once_with("https://example.com/news/1")

    def test_extract_internal_links_keeps_same_domain_and_removes_fragments(self):
        html = """
        <a href="/news/1#comments">One</a>
        <a href="https://example.com/news/1">Duplicate</a>
        <a href="https://other.example.net/news">External</a>
        <a href="mailto:test@example.com">Mail</a>
        """

        links = extract_internal_links(html, "https://example.com/section", "example.com")

        self.assertEqual(links, ["https://example.com/news/1"])

    def test_probable_article_url_requires_date_path_and_html(self):
        self.assertTrue(is_probable_article_url("https://example.com/successos/2026/05/19/headline-123.html"))
        self.assertFalse(is_probable_article_url("https://example.com/successos/"))
        self.assertFalse(is_probable_article_url("https://example.com/tags/sucesos/"))
        self.assertFalse(is_probable_article_url("https://example.com/municipis.html"))

    @patch("press.services.scraper.scrape_article_url")
    @patch("press.services.scraper.fetch_html")
    def test_scrape_section_only_scrapes_probable_article_links(self, fetch_html_mock, scrape_article_url_mock):
        self.outlet.section_url = "https://example.com/tags/sucesos/"
        fetch_html_mock.return_value = """
        <a href="/successos/2026/05/19/article-bo-123.html">Article</a>
        <a href="/tags/sucesos/">Tag</a>
        <a href="/municipis.html">Municipis</a>
        <a href="/girona/girona-ciutat/">City page</a>
        """
        scrape_article_url_mock.return_value = ScrapedArticle(
            url="https://example.com/successos/2026/05/19/article-bo-123.html",
            headline="Article bo",
        )

        articles = scrape_section(self.outlet)

        self.assertEqual(len(articles), 1)
        scrape_article_url_mock.assert_called_once_with(
            "https://example.com/successos/2026/05/19/article-bo-123.html"
        )

    def test_parse_feed_date_returns_none_for_invalid_values(self):
        self.assertIsNone(parse_feed_date(None))
        self.assertIsNone(parse_feed_date("not-a-date"))


class CeleryTaskTests(TestCase):
    def setUp(self):
        self.outlet = Outlet.objects.create(
            name="Diari Test",
            slug="diari-test",
            domain="example.com",
            homepage_url="https://example.com",
        )

    @patch("press.tasks.scrape_outlet")
    def test_scrape_outlet_task_calls_scraper_for_existing_outlet(self, scrape_outlet_mock):
        from press.tasks import scrape_outlet_task

        scrape_outlet_task(self.outlet.pk)

        scrape_outlet_mock.assert_called_once_with(self.outlet)

    @patch("press.tasks.scrape_outlet")
    def test_scrape_outlet_task_ignores_missing_outlet(self, scrape_outlet_mock):
        from press.tasks import scrape_outlet_task

        scrape_outlet_task(999)

        scrape_outlet_mock.assert_not_called()

    @patch("press.tasks.process_article")
    def test_process_article_task_calls_processor_for_existing_article(self, process_article_mock):
        from press.tasks import process_article_task

        article = RawArticle.objects.create(
            outlet=self.outlet,
            url="https://example.com/article",
            headline="Pelea",
            content_hash="hash-task",
            status=RawArticleStatus.NEW,
        )

        process_article_task(article.pk)

        process_article_mock.assert_called_once_with(article)

    @patch("press.tasks.process_article")
    def test_process_article_task_ignores_missing_article(self, process_article_mock):
        from press.tasks import process_article_task

        process_article_task(999)

        process_article_mock.assert_not_called()

    @patch("satire.tasks.generate_headline_for_incident")
    def test_generate_headline_task_calls_service_for_existing_incident(self, generate_mock):
        from satire.tasks import generate_headline_task

        incident = Incident.objects.create(
            canonical_title="Pelea en Barcelona",
            category=IncidentCategory.PELEA,
            severity_1_5=3,
            confidence_0_1=0.8,
            status=IncidentStatus.PENDING_REVIEW,
        )

        generate_headline_task(incident.pk)

        generate_mock.assert_called_once_with(incident)

    @patch("satire.tasks.generate_headline_for_incident")
    def test_generate_headline_task_ignores_missing_incident(self, generate_mock):
        from satire.tasks import generate_headline_task

        generate_headline_task(999)

        generate_mock.assert_not_called()


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


class OptimizedScraperTests(TestCase):
    def setUp(self):
        self.outlet = Outlet.objects.create(
            name="Diari Test",
            slug="diari-test",
            domain="example.com",
            homepage_url="https://example.com",
            rss_url="https://example.com/rss",
        )

    @patch("press.services.scraper.extract_text_and_image_from_url")
    @patch("press.services.scraper.feedparser.parse")
    def test_scrape_rss_skips_http_request_if_already_scraped(self, parse_mock, extract_mock):
        RawArticle.objects.create(
            outlet=self.outlet,
            url="https://example.com/news/already-exists",
            headline="Headline",
            content_hash="hash-1",
            status=RawArticleStatus.NEW,
        )

        parse_mock.return_value = SimpleNamespace(
            entries=[
                SimpleNamespace(
                    link="https://example.com/news/already-exists",
                    title="Headline",
                    summary="Excerpt",
                    published="Tue, 19 May 2026 10:30:00 +0200",
                )
            ]
        )

        articles = scrape_rss("https://example.com/rss")
        self.assertEqual(len(articles), 0)
        extract_mock.assert_not_called()

    @patch("press.services.scraper.extract_text_and_image_from_url")
    @patch("press.services.scraper.feedparser.parse")
    def test_scrape_rss_skips_http_request_if_no_keywords_match(self, parse_mock, extract_mock):
        parse_mock.return_value = SimpleNamespace(
            entries=[
                SimpleNamespace(
                    link="https://example.com/news/unrelated",
                    title="Concierto de música clásica en Barcelona",
                    summary="No hay palabras clave aquí.",
                    published="Tue, 19 May 2026 10:30:00 +0200",
                )
            ]
        )

        articles = scrape_rss("https://example.com/rss")
        self.assertEqual(len(articles), 1)
        self.assertIsNone(articles[0].raw_text)
        extract_mock.assert_not_called()

    @patch("press.services.scraper.extract_text_and_image_from_url")
    @patch("press.services.scraper.feedparser.parse")
    def test_scrape_rss_performs_http_request_if_relevant_and_new(self, parse_mock, extract_mock):
        parse_mock.return_value = SimpleNamespace(
            entries=[
                SimpleNamespace(
                    link="https://example.com/news/relevant",
                    title="Apuñalamiento grave en una estación de tren",
                    summary="Un suceso violento en la estación.",
                    published="Tue, 19 May 2026 10:30:00 +0200",
                )
            ]
        )
        extract_mock.return_value = ("Cuerpo del artículo", "https://example.com/image.jpg")

        articles = scrape_rss("https://example.com/rss")
        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0].raw_text, "Cuerpo del artículo")
        self.assertEqual(articles[0].image_url, "https://example.com/image.jpg")
        extract_mock.assert_called_once_with("https://example.com/news/relevant")
