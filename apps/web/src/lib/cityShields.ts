import { GENERATED_CITY_SHIELDS, GENERATED_CITY_SHIELD_SLUGS } from "./cityShields.generated";

export function normalizeCityShieldSlug(slug: string): string {
  return slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getCityShieldSrc(slug: string): string | null {
  const shield = GENERATED_CITY_SHIELDS[normalizeCityShieldSlug(slug)];
  if (!shield) return null;
  return typeof shield === "string" ? shield : shield.src;
}

export function getAvailableCityShieldSlugs(): string[] {
  return [...GENERATED_CITY_SHIELD_SLUGS];
}
