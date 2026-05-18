import logging
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
from press.services.extractor import extract_article, text_matches_keywords
from satire.services.headlines import generate_headline_for_incident

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process new/candidate raw articles into reviewable incidents."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=25)

    def handle(self, *args, **options):
        limit = options["limit"]
        queryset = RawArticle.objects.filter(
            status__in=[RawArticleStatus.NEW, RawArticleStatus.CANDIDATE]
        ).order_by("scraped_at")[:limit]
        processed = ignored = failed = created = 0
        for article in queryset:
            try:
                result = process_article(article)
                processed += 1
                if result == "ignored":
                    ignored += 1
                elif result == "created":
                    created += 1
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


@transaction.atomic
def process_article(article: RawArticle) -> str:
    if article.status not in {RawArticleStatus.NEW, RawArticleStatus.CANDIDATE}:
        return "ignored"
    if not text_matches_keywords(article.headline, article.excerpt, article.raw_text):
        article.status = RawArticleStatus.IGNORED
        article.save(update_fields=["status"])
        logger.info("article ignored by keyword filter article_id=%s", article.pk)
        return "ignored"

    extracted = extract_article(article)
    if not extracted.is_relevant or extracted.category == IncidentCategory.NO_RELEVANTE:
        article.status = RawArticleStatus.IGNORED
        article.save(update_fields=["status"])
        logger.info("article ignored by extractor article_id=%s", article.pk)
        return "ignored"

    city = get_or_create_city(extracted.city, extracted.province)
    incident = Incident.objects.create(
        canonical_title=extracted.short_neutral_summary or article.headline,
        city=city,
        neighborhood=extracted.neighborhood,
        province=extracted.province,
        category=extracted.category,
        happened_at=parse_happened_at(extracted.happened_at),
        severity_1_5=extracted.severity_1_5,
        confidence_0_1=extracted.confidence_0_1,
        status=IncidentStatus.PENDING_REVIEW,
        short_neutral_summary=extracted.short_neutral_summary,
        scoring_notes=extracted.scoring_notes,
        mentions_police_confirmation=extracted.mentions_police_confirmation,
        mentions_other_media_as_source=extracted.mentions_other_media_as_source,
        source_media_mentioned=extracted.source_media_mentioned,
    )
    IncidentSource.objects.create(incident=incident, article=article, is_primary=True)
    recalculate_incident_points(incident)
    if extracted.is_duplicate_or_update:
        mark_duplicate_if_needed(incident)
    else:
        mark_duplicate_if_needed(incident)
    try:
        generate_headline_for_incident(incident)
    except Exception:
        logger.warning("satirical headline generation failed incident_id=%s", incident.pk, exc_info=True)
    article.status = RawArticleStatus.PROCESSED
    article.error_message = None
    article.save(update_fields=["status", "error_message"])
    logger.info("article processed article_id=%s incident_id=%s", article.pk, incident.pk)
    return "created"


def get_or_create_city(name: str | None, province: str | None) -> City | None:
    if not name:
        return None
    slug = slugify(name)
    city, _ = City.objects.get_or_create(
        slug=slug,
        defaults={"name": name, "province": province or ""},
    )
    return city


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
