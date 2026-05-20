import logging

from django.core.management.base import BaseCommand

from press.models import Outlet
from press.services.scraper import scrape_active_outlets, scrape_outlet

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Scrape active whitelisted press outlets."

    def add_arguments(self, parser):
        parser.add_argument("--outlet", help="Scrape a single outlet by slug.")

    def handle(self, *args, **options):
        self.stdout.write("Starting press scrape")
        if options.get("outlet"):
            outlet = Outlet.objects.get(slug=options["outlet"])
            created = scrape_outlet(outlet)
            errors = 0
        else:
            created, errors = scrape_active_outlets()
        logger.info("scrape_press finished created=%s errors=%s", created, errors)
        self.stdout.write(self.style.SUCCESS(f"Scrape finished: created={created} errors={errors}"))
