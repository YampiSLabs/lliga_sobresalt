import logging
import time as time_sys
from datetime import datetime, time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.text import slugify

from core.choices import IncidentCategory, IncidentStatus, RawArticleStatus
from league.models import City
from league.services.scoring import recalculate_incident_points
from press.models import Incident, IncidentSource, RawArticle
from press.services.dedupe import mark_duplicate_if_needed
from press.services.extractor import ExtractedIncident, extract_article, extraction_to_dict, text_matches_keywords
from satire.services.headlines import generate_headline_for_incident

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process new/candidate raw articles into reviewable incidents."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument(
            "--approve",
            action="store_true",
            help="Auto-approve created incidents and their satirical headlines.",
        )

    def handle(self, *args, **options):
        from django.conf import settings
        limit = options.get("limit")
        approve = options.get("approve", False)
        if limit is None:
            limit = getattr(settings, "OPENROUTER_MAX_ARTICLES_PER_BATCH", 5)
        queryset = RawArticle.objects.filter(
            status__in=[RawArticleStatus.NEW, RawArticleStatus.CANDIDATE]
        ).order_by("scraped_at")[:limit]
        processed = ignored = failed = created = 0
        queryset_list = list(queryset)
        for idx, article in enumerate(queryset_list):
            try:
                result = process_article(article, approve=approve)
                processed += 1
                if result == "ignored":
                    ignored += 1
                elif result == "created":
                    created += 1
                if idx < len(queryset_list) - 1:
                    time_sys.sleep(2)
            except Exception as exc:
                failed += 1
                article.status = RawArticleStatus.FAILED
                article.error_message = str(exc)
                article.save(update_fields=["status", "error_message"])
                logger.exception("article processing failed article_id=%s url=%s", article.pk, article.url)
        logger.info(
            "process_articles finished processed=%s created=%s ignored=%s failed=%s",
            processed,
            created,
            ignored,
            failed,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Processing finished: processed={processed} created={created} ignored={ignored} failed={failed}"
            )
        )


def process_article(article: RawArticle, approve: bool = False) -> str:
    if article.status not in {
        RawArticleStatus.NEW,
        RawArticleStatus.CANDIDATE,
        RawArticleStatus.FAILED,
        RawArticleStatus.PROCESSING,
        RawArticleStatus.FAILED_AI,
    }:
        return "ignored"
    if not text_matches_keywords(article.headline, article.excerpt, article.raw_text):
        article.status = RawArticleStatus.IGNORED
        article.save(update_fields=["status"])
        logger.info("article ignored by keyword filter article_id=%s", article.pk)
        return "ignored"

    extracted = extract_article(article)
    return persist_extracted_article(article, extracted, approve=approve)


@transaction.atomic
def persist_extracted_article(article: RawArticle, extracted: ExtractedIncident, approve: bool = False) -> str:
    article.ai_extraction = extraction_to_dict(extracted)
    article.ai_extracted_at = timezone.now()
    if not extracted.is_relevant or extracted.category == IncidentCategory.NO_RELEVANTE:
        article.status = RawArticleStatus.IGNORED
        article.error_message = None
        article.save(update_fields=["ai_extraction", "ai_extracted_at", "status", "error_message"])
        logger.info("article ignored by extractor article_id=%s", article.pk)
        return "ignored"

    city = get_or_create_city(extracted.city, extracted.province)
    if not city:
        article.status = RawArticleStatus.IGNORED
        article.error_message = f"Ignored because city '{extracted.city}' is not in the active 11 cities."
        article.save(update_fields=["ai_extraction", "ai_extracted_at", "status", "error_message"])
        logger.info("article ignored due to inactive city name=%s article_id=%s", extracted.city, article.pk)
        return "ignored"

    incident_status = IncidentStatus.APPROVED if approve else IncidentStatus.PENDING_REVIEW

    incident = Incident.objects.create(
        canonical_title_ca=extracted.short_neutral_summary_ca or article.headline,
        canonical_title_es=extracted.short_neutral_summary_es or article.headline,
        canonical_title_en=extracted.short_neutral_summary_en or article.headline,
        city=city,
        neighborhood=extracted.neighborhood,
        province=extracted.province,
        category=extracted.category,
        happened_at=parse_happened_at(extracted.happened_at) or article.published_at or article.scraped_at,
        severity_1_5=extracted.severity_1_5,
        confidence_0_1=extracted.confidence_0_1,
        status=incident_status,
        short_neutral_summary_ca=extracted.short_neutral_summary_ca,
        short_neutral_summary_es=extracted.short_neutral_summary_es,
        short_neutral_summary_en=extracted.short_neutral_summary_en,
        scoring_notes_ca=extracted.scoring_notes_ca,
        scoring_notes_es=extracted.scoring_notes_es,
        scoring_notes_en=extracted.scoring_notes_en,
        mentions_police_confirmation=extracted.mentions_police_confirmation,
        mentions_other_media_as_source=extracted.mentions_other_media_as_source,
        source_media_mentioned=extracted.source_media_mentioned,
        image_url=article.image_url,
        thumbnail_url=article.thumbnail_url,
        image_disclaimer_ca=f"Imatge original de {article.outlet.name}" if article.image_url else None,
        image_disclaimer_es=f"Imagen original de {article.outlet.name}" if article.image_url else None,
        image_disclaimer_en=f"Original image from {article.outlet.name}" if article.image_url else None,
    )
    IncidentSource.objects.create(incident=incident, article=article, is_primary=True)
    recalculate_incident_points(incident)
    mark_duplicate_if_needed(incident, is_llm_duplicate=extracted.is_duplicate_or_update)
    try:
        if approve:
            generate_headline_for_incident(incident, approve=True)
        else:
            generate_headline_for_incident(incident)
    except Exception:
        logger.warning("satirical headline generation failed incident_id=%s", incident.pk, exc_info=True)

    article.status = RawArticleStatus.PROCESSED
    article.error_message = None
    article.save(update_fields=["ai_extraction", "ai_extracted_at", "status", "error_message"])
    logger.info("article processed article_id=%s incident_id=%s", article.pk, incident.pk)
    return "created"


def get_or_create_city(name: str | None, province: str | None) -> City | None:
    if not name:
        return None
    slug = slugify(name)

    # 1. Search by slug directly
    city = City.objects.filter(slug=slug).first()
    if city:
        return city

    # 2. Search by name case-insensitively
    city = City.objects.filter(name__iexact=name).first()
    if city:
        return city

    # 3. Check aliases on active cities
    for c in City.objects.filter(is_active=True):
        aliases = c.aliases or []
        if name.lower() in [a.lower() for a in aliases] or slug in [a.lower() for a in aliases]:
            return c

    return None


def parse_happened_at(value: str | None):
    if not value:
        return None
    parsed_datetime = parse_datetime(value)
    if parsed_datetime:
        if timezone.is_naive(parsed_datetime):
            return timezone.make_aware(parsed_datetime)
        return parsed_datetime
    parsed_date = parse_date(value)
    if parsed_date:
        return timezone.make_aware(datetime.combine(parsed_date, time.min))
    return None
