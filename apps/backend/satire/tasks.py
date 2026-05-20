from __future__ import annotations

import logging

from celery import shared_task

from press.models import Incident
from satire.services.headlines import generate_headline_for_incident

logger = logging.getLogger(__name__)


@shared_task(name="generate_headline_task")
def generate_headline_task(incident_id: int) -> str:
    incident = Incident.objects.filter(pk=incident_id).first()
    if not incident:
        logger.info("generate_headline_task skipped missing incident_id=%s", incident_id)
        return "missing"
    headline = generate_headline_for_incident(incident)
    logger.info(
        "generate_headline_task finished incident_id=%s created=%s",
        incident_id,
        bool(headline),
    )
    return "created" if headline else "skipped"
