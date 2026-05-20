import os
import logging
from django.db.models import Q
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.conf import settings
from .models import RawArticle, Incident

logger = logging.getLogger(__name__)


def delete_local_file_if_unused(file_url: str | None) -> None:
    if not file_url:
        return

    # Verificar si es una URL local que empieza por settings.MEDIA_URL o /media/
    media_url_prefix = getattr(settings, "MEDIA_URL", "/media/")
    if not file_url.startswith(media_url_prefix):
        return

    relative_path = file_url[len(media_url_prefix):]
    absolute_path = os.path.join(settings.MEDIA_ROOT, relative_path)

    # Comprobar si algún otro registro de RawArticle o de Incident usa esta URL exacta
    in_raw_articles = RawArticle.objects.filter(
        Q(image_url=file_url) | Q(thumbnail_url=file_url)
    ).exists()

    in_incidents = Incident.objects.filter(
        Q(image_url=file_url) | Q(thumbnail_url=file_url)
    ).exists()

    if not in_raw_articles and not in_incidents:
        if os.path.exists(absolute_path):
            try:
                os.remove(absolute_path)
                logger.info("Successfully deleted orphaned media file from disk: %s", absolute_path)
            except Exception as e:
                logger.warning("Failed to delete orphaned media file %s: %s", absolute_path, e)
        else:
            logger.debug("File %s does not exist on disk, skipped deletion", absolute_path)


@receiver(post_delete, sender=RawArticle)
def on_raw_article_deleted(sender, instance, **kwargs):
    delete_local_file_if_unused(instance.image_url)
    delete_local_file_if_unused(instance.thumbnail_url)


@receiver(post_delete, sender=Incident)
def on_incident_deleted(sender, instance, **kwargs):
    delete_local_file_if_unused(instance.image_url)
    delete_local_file_if_unused(instance.thumbnail_url)
