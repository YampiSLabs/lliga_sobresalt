import logging

from django.core.management.base import BaseCommand

from press.services.scraper import scrape_active_outlets

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Scrape active whitelisted press outlets."

    def handle(self, *args, **options):
        self.stdout.write("Starting press scrape")
        created, errors = scrape_active_outlets()
        logger.info("scrape_press finished created=%s errors=%s", created, errors)
        self.stdout.write(self.style.SUCCESS(f"Scrape finished: created={created} errors={errors}"))

