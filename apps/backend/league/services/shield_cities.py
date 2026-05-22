from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.db import transaction

from league.models import City

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "data" / "shield_cities.json"


@dataclass(frozen=True)
class ShieldCitySyncResult:
    created: int = 0
    updated: int = 0
    unchanged: int = 0


def load_shield_cities(path: Path = MANIFEST_PATH) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as manifest_file:
        data = json.load(manifest_file)
    return sorted(data, key=lambda item: item["slug"])


def merge_aliases(existing_aliases: list[str] | None, manifest_slug: str, manifest_aliases: list[str], city_slug: str) -> list[str]:
    aliases: list[str] = []
    for alias in [*(existing_aliases or []), manifest_slug, *manifest_aliases]:
        if alias == city_slug or alias in aliases:
            continue
        aliases.append(alias)
    return aliases


def find_existing_city(slug: str, aliases: list[str]) -> City | None:
    candidate_slugs = [slug, *aliases]
    return City.objects.filter(slug__in=candidate_slugs).order_by("pk").first()


@transaction.atomic
def sync_shield_cities(*, apply: bool = False) -> ShieldCitySyncResult:
    result = ShieldCitySyncResult()
    created = updated = unchanged = 0
    for item in load_shield_cities():
        aliases = item.get("aliases") or []
        city = find_existing_city(item["slug"], aliases)
        if city is None:
            created += 1
            if apply:
                City.objects.create(
                    name=item["name"],
                    slug=item["slug"],
                    province=item.get("province"),
                    aliases=merge_aliases([], item["slug"], aliases, item["slug"]),
                    is_active=True,
                )
            continue

        merged_aliases = merge_aliases(city.aliases, item["slug"], aliases, city.slug)
        changes = {
            "name": item["name"],
            "province": item.get("province"),
            "aliases": merged_aliases,
            "is_active": True,
        }
        needs_update = any(getattr(city, field) != value for field, value in changes.items())
        if needs_update:
            updated += 1
            if apply:
                for field, value in changes.items():
                    setattr(city, field, value)
                city.save(update_fields=[*changes.keys()])
        else:
            unchanged += 1

    return ShieldCitySyncResult(created=created, updated=updated, unchanged=unchanged)
