from __future__ import annotations

import logging

from celery import shared_task
from django.core.management import call_command

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
    if limit is None:
        limit = getattr(settings, "OPENROUTER_MAX_ARTICLES_PER_BATCH", 5)
    call_command("process_articles", limit=limit)


@shared_task(name="scrape_outlet_task")
def scrape_outlet_task(outlet_id: int) -> int:
    outlet = Outlet.objects.filter(pk=outlet_id).first()
    if not outlet:
        logger.info("scrape_outlet_task skipped missing outlet_id=%s", outlet_id)
        return 0
    created = scrape_outlet(outlet)
    logger.info("scrape_outlet_task finished outlet_id=%s created=%s", outlet_id, created)
    return created


@shared_task(name="process_article_task")
def process_article_task(article_id: int) -> str:
    article = RawArticle.objects.filter(pk=article_id).first()
    if not article:
        logger.info("process_article_task skipped missing article_id=%s", article_id)
        return "missing"
    result = process_article(article)
    logger.info("process_article_task finished article_id=%s result=%s", article_id, result)
    return result
