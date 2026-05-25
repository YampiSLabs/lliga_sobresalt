from __future__ import annotations

import logging
import httpx

from celery import shared_task
from django.core.management import call_command

from core.llm import OpenRouterQuotaExceeded, openrouter_dispatch_capacity
from press.models import Outlet, RawArticle
from press.management.commands.process_articles import process_article
from press.services.scraper import scrape_outlet

logger = logging.getLogger(__name__)


@shared_task(name="scrape_press_task")
def scrape_press_task() -> None:
    call_command("scrape_press")


@shared_task(name="process_articles_task")
def process_articles_task(limit: int | None = None) -> None:
    from django.conf import settings
    from django.db import transaction
    from django.utils import timezone
    from core.choices import RawArticleStatus
    from press.models import RawArticle
    from league.services.shield_cities import sync_shield_cities

    try:
        sync_shield_cities(apply=True)
    except Exception as exc:
        logger.warning("Failed to run automatic sync_shield_cities in process_articles_task: %s", exc)

    if limit is None:
        limit = openrouter_dispatch_capacity(
            max_articles=getattr(settings, "OPENROUTER_MAX_ARTICLES_PER_BATCH", 5)
        )
        if limit <= 0 and getattr(settings, "OPENCODE_API_KEY", ""):
            limit = getattr(settings, "OPENROUTER_MAX_ARTICLES_PER_BATCH", 5)
    if limit <= 0:
        logger.info("process_articles_task skipped because OpenRouter pacing has no capacity")
        return

    stale_cutoff = timezone.now() - timezone.timedelta(hours=1)
    stale_count = RawArticle.objects.filter(
        status=RawArticleStatus.PROCESSING,
        scraped_at__lt=stale_cutoff,
    ).update(
        status=RawArticleStatus.FAILED,
        error_message="Requeued after stale processing timeout.",
    )
    if stale_count:
        logger.warning("Requeued stale processing articles count=%s", stale_count)

    with transaction.atomic():
        queryset = RawArticle.objects.select_for_update().filter(
            status__in=[RawArticleStatus.NEW, RawArticleStatus.CANDIDATE, RawArticleStatus.FAILED]
        ).order_by("scraped_at")[:limit]

        articles_to_enqueue = list(queryset)
        for article in articles_to_enqueue:
            article.status = RawArticleStatus.PROCESSING
            article.save(update_fields=["status"])

    for article in articles_to_enqueue:
        process_article_task.delay(article.pk)


@shared_task(name="scrape_outlet_task")
def scrape_outlet_task(outlet_id: int) -> int:
    outlet = Outlet.objects.filter(pk=outlet_id).first()
    if not outlet:
        logger.info("scrape_outlet_task skipped missing outlet_id=%s", outlet_id)
        return 0
    created = scrape_outlet(outlet)
    logger.info("scrape_outlet_task finished outlet_id=%s created=%s", outlet_id, created)
    return created


@shared_task(
    bind=True,
    name="process_article_task",
    rate_limit="18/m",
    autoretry_for=(RuntimeError, httpx.HTTPError),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5,
)
def process_article_task(self, article_id: int) -> str:
    from django.conf import settings
    from core.choices import RawArticleStatus

    article = RawArticle.objects.filter(pk=article_id).first()
    if not article:
        logger.info("process_article_task skipped missing article_id=%s", article_id)
        return "missing"

    try:
        result = process_article(
            article,
            approve=getattr(settings, "AUTO_APPROVE_EXTRACTED_INCIDENTS", False),
        )
        logger.info("process_article_task finished article_id=%s result=%s", article_id, result)
        return result
    except OpenRouterQuotaExceeded as exc:
        article.status = RawArticleStatus.FAILED
        article.error_message = f"OpenRouter quota exhausted; deferred for later retry: {exc}"
        article.save(update_fields=["status", "error_message"])
        logger.info("process_article_task deferred article_id=%s: %s", article_id, exc)
        return "deferred"
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            article.status = RawArticleStatus.FAILED_AI
            article.error_message = f"AI extraction permanently failed after {self.max_retries} retries: {exc}"
            article.save(update_fields=["status", "error_message"])
            logger.error("process_article_task permanently failed article_id=%s: %s", article_id, exc, exc_info=True)
        else:
            article.status = RawArticleStatus.FAILED
            article.error_message = f"AI extraction failed, retrying ({self.request.retries + 1}/{self.max_retries}): {exc}"
            article.save(update_fields=["status", "error_message"])
            logger.warning("process_article_task failed, retrying (%s/%s) article_id=%s: %s", self.request.retries + 1, self.max_retries, article_id, exc)
        raise exc
