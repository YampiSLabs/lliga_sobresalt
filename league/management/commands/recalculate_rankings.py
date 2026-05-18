import logging

from django.core.management.base import BaseCommand

from league.services.ranking import recalculate_active_round

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Recalculate city scores for the active league round."

    def handle(self, *args, **options):
        self.stdout.write("Starting ranking recalculation")
        count = recalculate_active_round()
        logger.info("recalculate_rankings finished city_scores=%s", count)
        self.stdout.write(self.style.SUCCESS(f"Ranking recalculated: city_scores={count}"))

