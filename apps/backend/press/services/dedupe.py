from __future__ import annotations

from datetime import timedelta
from difflib import SequenceMatcher

from django.db.models import Q

from core.choices import IncidentStatus
from press.models import Incident

SIMILARITY_THRESHOLD = 0.82


def title_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left.casefold(), right.casefold()).ratio()


def find_duplicate_for(incident: Incident, is_llm_duplicate: bool = False) -> Incident | None:
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

    # 1. Si el LLM lo catalogó como duplicado o actualización y hay candidatos previos en el mismo rango,
    # asociarlo directamente con el candidato más reciente.
    if is_llm_duplicate and candidates.exists():
        return candidates.order_by("-happened_at").first()

    # 2. Si no, usamos similitud de títulos basada en SequenceMatcher con umbral dinámico.
    for candidate in candidates:
        sim = title_similarity(incident.canonical_title, candidate.canonical_title)
        threshold = 0.70 if (incident.happened_at and candidate.happened_at and incident.happened_at.date() == candidate.happened_at.date()) else SIMILARITY_THRESHOLD
        if sim > threshold:
            return candidate
    return None


def mark_duplicate_if_needed(incident: Incident, is_llm_duplicate: bool = False) -> bool:
    duplicate = find_duplicate_for(incident, is_llm_duplicate=is_llm_duplicate)
    if not duplicate:
        return False
    incident.status = IncidentStatus.DUPLICATE
    incident.is_duplicate_of = duplicate
    incident.points = 0
    incident.save(update_fields=["status", "is_duplicate_of", "points", "updated_at"])
    return True
