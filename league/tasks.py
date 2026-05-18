from __future__ import annotations

from celery import shared_task
from django.core.management import call_command


@shared_task(name="recalculate_rankings_task")
def recalculate_rankings_task() -> None:
    call_command("recalculate_rankings")

