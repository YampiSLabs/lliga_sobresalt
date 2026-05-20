from django.shortcuts import get_object_or_404, render
from django.db.models import Prefetch, Q
from django.http import JsonResponse

from core.choices import IncidentStatus, RoundStatus
from league.models import City, CityScore, LeagueSeason, LeagueRound
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


def api_ranking(request):
    round_id = request.GET.get("round_id") or request.GET.get("round")
    if round_id:
        try:
            rows = CityScore.objects.filter(round_id=int(round_id)).select_related("city")
        except ValueError:
            return JsonResponse({"error": "Invalid round_id"}, status=400)
    else:
        active_round = get_active_round()
        if not active_round:
            return JsonResponse([], safe=False)
        rows = CityScore.objects.filter(round=active_round).select_related("city")
    return JsonResponse(
        [
            {
                "position": row.position,
                "city": {"name": row.city.name, "slug": row.city.slug},
                "points": row.points,
                "incidents_count": row.incidents_count,
            }
            for row in rows
        ],
        safe=False,
    )


def api_incidents(request):
    incidents = public_incidents().prefetch_related("sources__article__outlet")
    city = request.GET.get("city")
    category = request.GET.get("category")
    search_query = request.GET.get("q") or request.GET.get("query") or request.GET.get("search")
    severity_min = request.GET.get("severity_min")
    severity_max = request.GET.get("severity_max")
    sort = request.GET.get("sort")

    if city:
        incidents = incidents.filter(city__slug=city)
    if category:
        categories = [c.strip() for c in category.split(",") if c.strip()]
        if len(categories) == 1:
            incidents = incidents.filter(category=categories[0])
        elif len(categories) > 1:
            incidents = incidents.filter(category__in=categories)
    if search_query:
        incidents = incidents.filter(
            Q(canonical_title__icontains=search_query) | Q(short_neutral_summary__icontains=search_query)
        )
    if severity_min:
        try:
            incidents = incidents.filter(severity_1_5__gte=int(severity_min))
        except ValueError:
            pass
    if severity_max:
        try:
            incidents = incidents.filter(severity_1_5__lte=int(severity_max))
        except ValueError:
            pass

    if sort:
        sort_mapping = {
            "happened_at_asc": "happened_at",
            "happened_at_desc": "-happened_at",
            "points_asc": "points",
            "points_desc": "-points",
            "severity_asc": "severity_1_5",
            "severity_desc": "-severity_1_5",
        }
        order_by_field = sort_mapping.get(sort)
        if order_by_field:
            incidents = incidents.order_by(order_by_field)

    limit = parse_limit(request.GET.get("limit"), default=50, maximum=100)
    incidents = incidents[:limit]
    return JsonResponse(
        [
            {
                "id": incident.pk,
                "canonical_title": incident.canonical_title,
                "city": (
                    {"name": incident.city.name, "slug": incident.city.slug}
                    if incident.city
                    else None
                ),
                "category": incident.category,
                "points": incident.points,
                "short_neutral_summary": incident.short_neutral_summary,
                "satirical_headline": (
                    incident.satirical_headlines.first().text
                    if incident.satirical_headlines.exists()
                    else None
                ),
                "happened_at": incident.happened_at,
                "image_url": incident.image_url,
                "thumbnail_url": incident.thumbnail_url,
                "image_disclaimer": incident.image_disclaimer,
                "sources": [
                    {
                        "outlet_name": src.article.outlet.name,
                        "url": src.article.url,
                    }
                    for src in incident.sources.all()
                ],
            }
            for incident in incidents
        ],
        safe=False,
    )


def api_seasons(request):
    seasons = LeagueSeason.objects.prefetch_related(
        "rounds", "rounds__city_scores", "rounds__city_scores__city"
    )
    data = []
    for season in seasons:
        scores_by_city = {}
        for round_obj in season.rounds.all():
            for score in round_obj.city_scores.all():
                city_id = score.city.id
                if city_id not in scores_by_city:
                    scores_by_city[city_id] = {
                        "name": score.city.name,
                        "slug": score.city.slug,
                        "points": 0,
                        "incidents_count": 0,
                    }
                scores_by_city[city_id]["points"] += score.points
                scores_by_city[city_id]["incidents_count"] += score.incidents_count

        sorted_cities = sorted(scores_by_city.values(), key=lambda x: (-x["points"], -x["incidents_count"]))
        podium = []
        for pos, item in enumerate(sorted_cities[:3], start=1):
            podium.append({
                "pos": pos,
                "name": item["name"],
                "slug": item["slug"],
                "points": round(item["points"], 2),
                "incidents_count": item["incidents_count"],
            })

        winner = podium[0] if podium else None

        has_open_round = season.rounds.filter(status=RoundStatus.OPEN).exists()
        status = "Activa" if (season.is_active and has_open_round) else "Finalitzada"

        data.append({
            "id": season.id,
            "name": season.name,
            "starts_at": season.starts_at,
            "ends_at": season.ends_at,
            "status": status,
            "winner": winner,
            "podium": podium,
            "rounds": [
                {
                    "id": rnd.id,
                    "name": rnd.name,
                    "starts_at": rnd.starts_at,
                    "ends_at": rnd.ends_at,
                    "status": rnd.status,
                }
                for rnd in season.rounds.all()
            ]
        })
    return JsonResponse(data, safe=False)


def parse_limit(value: str | None, *, default: int, maximum: int) -> int:
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    if parsed < 1:
        return default
    return min(parsed, maximum)
