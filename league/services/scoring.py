from __future__ import annotations

from core.choices import IncidentCategory, IncidentStatus
from league.models import ScoringRule
from press.models import Incident

DEFAULT_BASE_POINTS: dict[str, float] = {
    IncidentCategory.APUNYALAMENT: 12,
    IncidentCategory.ARMA_BLANCA: 12,
    IncidentCategory.HOMICIDIO: 25,
    IncidentCategory.ROBO_VIOLENTO: 7,
    IncidentCategory.PELEA: 8,
    IncidentCategory.AGRESION: 6,
    IncidentCategory.INCIVISMO: 4,
    IncidentCategory.DISTURBIOS: 6,
    IncidentCategory.TRANSPORTE_PUBLICO: 5,
    IncidentCategory.OTRO_SUCESO: 2,
    IncidentCategory.NO_RELEVANTE: 0,
}

SEVERITY_MULTIPLIERS = {
    1: 0.5,
    2: 0.75,
    3: 1.0,
    4: 1.25,
    5: 1.6,
}


def base_points_for(category: str) -> float:
    rule = ScoringRule.objects.filter(category=category, is_active=True).first()
    if rule:
        return rule.base_points
    return DEFAULT_BASE_POINTS.get(category, 0)


def calculate_points(incident: Incident) -> float:
    if incident.status == IncidentStatus.DUPLICATE or incident.is_duplicate_of_id:
        return 0
    base_points = base_points_for(incident.category)
    severity_multiplier = SEVERITY_MULTIPLIERS.get(incident.severity_1_5, 1.0)
    points = base_points * incident.confidence_0_1 * severity_multiplier
    if incident.category == IncidentCategory.TRANSPORTE_PUBLICO:
        points += 3
    return round(points, 2)


def recalculate_incident_points(incident: Incident) -> float:
    incident.points = calculate_points(incident)
    incident.save(update_fields=["points", "updated_at"])
    return incident.points

