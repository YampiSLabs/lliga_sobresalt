from __future__ import annotations

from django.db.models import Count, Sum

from core.choices import IncidentStatus, RoundStatus
from league.models import City, CityScore, LeagueRound
from press.models import Incident


def get_active_round() -> LeagueRound | None:
    return LeagueRound.objects.filter(status=RoundStatus.OPEN, season__is_active=True).order_by("-starts_at").first()


def recalculate_active_round() -> int:
    active_round = get_active_round()
    if not active_round:
        return 0
    return recalculate_round(active_round)


def recalculate_round(round_obj: LeagueRound) -> int:
    CityScore.objects.filter(round=round_obj).delete()
    queryset = (
        Incident.objects.filter(
            status=IncidentStatus.APPROVED,
            city__isnull=False,
            happened_at__gte=round_obj.starts_at,
            happened_at__lte=round_obj.ends_at,
        )
        .values("city")
        .annotate(points=Sum("points"), incidents_count=Count("id"))
        .order_by("-points", "-incidents_count")
    )
    created = 0
    for position, row in enumerate(queryset, start=1):
        CityScore.objects.create(
            round=round_obj,
            city=City.objects.get(pk=row["city"]),
            points=row["points"] or 0,
            incidents_count=row["incidents_count"],
            position=position,
        )
        created += 1
    return created

