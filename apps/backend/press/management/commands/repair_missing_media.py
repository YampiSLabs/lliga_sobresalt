import logging
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from core.choices import IncidentStatus
from press.models import Incident
from press.services.scraper import download_image, extract_text_and_image_from_url

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Re-download missing local incident media from primary source article pages."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--all-statuses", action="store_true")

    def handle(self, *args, **options):
        limit = options["limit"]
        dry_run = options["dry_run"]
        queryset = Incident.objects.prefetch_related("sources__article__outlet").distinct()
        if not options["all_statuses"]:
            queryset = queryset.filter(status=IncidentStatus.APPROVED)

        checked = repaired = skipped = failed = 0
        for incident in queryset.order_by("-created_at")[:limit]:
            checked += 1
            try:
                result = repair_incident_media(incident, dry_run=dry_run)
            except Exception:
                failed += 1
                logger.exception("media repair failed incident_id=%s", incident.pk)
                continue

            if result == "repaired":
                repaired += 1
            else:
                skipped += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Media repair finished: checked={checked} repaired={repaired} skipped={skipped} failed={failed}"
            )
        )


def repair_incident_media(incident: Incident, *, dry_run: bool = False) -> str:
    if not needs_media_repair(incident.image_url) and not needs_media_repair(incident.thumbnail_url):
        return "skipped"

    source = incident.sources.filter(is_primary=True).select_related("article", "article__outlet").first()
    if not source:
        source = incident.sources.select_related("article", "article__outlet").first()
    if not source:
        return "skipped"

    _, original_image_url = extract_text_and_image_from_url(source.article.url)
    if not original_image_url:
        return "skipped"

    if dry_run:
        return "repaired"

    image_url, thumbnail_url = download_image(original_image_url, source.article.outlet.slug)
    if not image_url:
        return "skipped"

    article = source.article
    article.image_url = image_url
    article.thumbnail_url = thumbnail_url
    article.save(update_fields=["image_url", "thumbnail_url"])

    incident.image_url = image_url
    incident.thumbnail_url = thumbnail_url
    set_image_disclaimer(incident, source.article.outlet.name)
    incident.save(
        update_fields=[
            "image_url",
            "thumbnail_url",
            "image_disclaimer",
            "image_disclaimer_ca",
            "image_disclaimer_es",
            "image_disclaimer_en",
        ]
    )
    return "repaired"


def needs_media_repair(url: str | None) -> bool:
    if not url:
        return True
    if not is_local_media_url(url):
        return False
    return not media_file_exists(url)


def is_local_media_url(url: str) -> bool:
    media_url = settings.MEDIA_URL
    return url.startswith(media_url) or url.startswith("/media/")


def media_file_exists(url: str) -> bool:
    media_url = settings.MEDIA_URL
    relative_path = url
    for prefix in (media_url, "/media/"):
        if relative_path.startswith(prefix):
            relative_path = relative_path[len(prefix):]
            break
    return (Path(settings.MEDIA_ROOT) / relative_path).exists()


def set_image_disclaimer(incident: Incident, outlet_name: str) -> None:
    incident.image_disclaimer_ca = f"Imatge original de {outlet_name}"
    incident.image_disclaimer_es = f"Imagen original de {outlet_name}"
    incident.image_disclaimer_en = f"Original image from {outlet_name}"
