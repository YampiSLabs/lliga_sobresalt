from __future__ import annotations

from datetime import timedelta
from difflib import SequenceMatcher

from django.db.models import Q

from core.choices import IncidentStatus
from press.models import Incident

SIMILARITY_THRESHOLD = 0.82


def title_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left.casefold(), right.casefold()).ratio()


def find_duplicate_for(incident: Incident) -> Incident | None:
    if not incident.city_id:
        return None
    candidates = Incident.objects.filter(
        city=incident.city,
        category=incident.category,
        status__in=[IncidentStatus.PENDING_REVIEW, IncidentStatus.APPROVED],
    )
    if incident.pk:
        candidates = candidates.exclude(pk=incident.pk)
    if incident.happened_at:
        start = incident.happened_at - timedelta(days=2)
        end = incident.happened_at + timedelta(days=2)
        candidates = candidates.filter(Q(happened_at__range=(start, end)) | Q(happened_at__isnull=True))
    for candidate in candidates:
        if title_similarity(incident.canonical_title, candidate.canonical_title) > SIMILARITY_THRESHOLD:
            return candidate
    return None


def mark_duplicate_if_needed(incident: Incident) -> bool:
    duplicate = find_duplicate_for(incident)
    if not duplicate:
        return False
    incident.status = IncidentStatus.DUPLICATE
    incident.is_duplicate_of = duplicate
    incident.points = 0
    incident.save(update_fields=["status", "is_duplicate_of", "points", "updated_at"])
    return True

