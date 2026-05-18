from django.shortcuts import get_object_or_404, render
from django.db.models import Prefetch

from core.choices import IncidentStatus
from league.models import City, CityScore
from league.services.ranking import get_active_round
from press.models import Incident
from satire.models import SatiricalHeadline

DISCLAIMER = (
    "Ranking satírico basado únicamente en noticias publicadas por medios de prensa. "
    "No es estadística oficial ni mide criminalidad real."
)


def home(request):
    active_round = get_active_round()
    ranking = CityScore.objects.filter(round=active_round).select_related("city")[:20] if active_round else []
    incidents = public_incidents()[:10]
    return render(
        request,
        "core/home.html",
        {"disclaimer": DISCLAIMER, "active_round": active_round, "ranking": ranking, "incidents": incidents},
    )


def weekly_ranking(request):
    active_round = get_active_round()
    ranking = CityScore.objects.filter(round=active_round).select_related("city") if active_round else []
    return render(
        request,
        "core/ranking.html",
        {"disclaimer": DISCLAIMER, "active_round": active_round, "ranking": ranking},
    )


def city_detail(request, slug: str):
    city = get_object_or_404(City, slug=slug, is_active=True)
    active_round = get_active_round()
    score = CityScore.objects.filter(round=active_round, city=city).first() if active_round else None
    incidents = public_incidents().filter(city=city)[:20]
    headlines = SatiricalHeadline.objects.filter(incident__city=city, approved=True).select_related("incident")[:20]
    return render(
        request,
        "core/city_detail.html",
        {
            "disclaimer": DISCLAIMER,
            "city": city,
            "active_round": active_round,
            "score": score,
            "incidents": incidents,
            "headlines": headlines,
        },
    )


def incident_detail(request, pk: int):
    incident = get_object_or_404(
        public_incidents().prefetch_related("sources__article", "satirical_headlines"),
        pk=pk,
    )
    headline = incident.satirical_headlines.filter(approved=True).first()
    primary_source = incident.sources.filter(is_primary=True).select_related("article", "article__outlet").first()
    return render(
        request,
        "core/incident_detail.html",
        {
            "disclaimer": DISCLAIMER,
            "incident": incident,
            "headline": headline,
            "primary_source": primary_source,
        },
    )


def public_incidents():
    return (
        Incident.objects.filter(status=IncidentStatus.APPROVED)
        .select_related("city")
        .prefetch_related(Prefetch("satirical_headlines", queryset=SatiricalHeadline.objects.filter(approved=True)))
        .order_by("-created_at")
    )

