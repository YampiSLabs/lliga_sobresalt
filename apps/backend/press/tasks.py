from __future__ import annotations

from celery import shared_task
from django.core.management import call_command


@shared_task(name="scrape_press_task")
def scrape_press_task() -> None:
    call_command("scrape_press")


@shared_task(name="process_articles_task")
def process_articles_task() -> None:
    call_command("process_articles")

