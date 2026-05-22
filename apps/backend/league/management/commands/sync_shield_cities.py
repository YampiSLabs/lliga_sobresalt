from django.core.management.base import BaseCommand, CommandError

from league.services.shield_cities import sync_shield_cities


class Command(BaseCommand):
    help = "Sync active cities from the generated catalunya-shields manifest."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true", help="Write city changes to the database.")
        mode.add_argument("--dry-run", action="store_true", help="Preview city changes without writing.")

    def handle(self, *args, **options):
        apply_changes = options.get("apply", False)
        if not apply_changes and not options.get("dry_run", False):
            raise CommandError("Choose either --dry-run or --apply.")

        result = sync_shield_cities(apply=apply_changes)
        mode = "applied" if apply_changes else "dry-run"
        self.stdout.write(
            self.style.SUCCESS(
                f"Shield city sync {mode}: created={result.created} updated={result.updated} unchanged={result.unchanged}"
            )
        )
