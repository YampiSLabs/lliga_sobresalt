import ky from "ky";
import type { z } from "zod";
import { RankingResponseSchema, IncidentsResponseSchema } from "./schemas";
import type { CityScore, Incident } from "./schemas";
import { publicAsset } from "./assetPaths";

const api = ky.create({
  prefix: import.meta.env.PUBLIC_API_BASE_URL || "http://localhost:8000",
  timeout: 5000,
  retry: 1,
});

const MOCK_RANKING: CityScore[] = [
  {
    position: 1,
    city: { name: "Barcelona", slug: "barcelona" },
    points: 84,
    incidents_count: 7,
  },
  {
    position: 2,
    city: { name: "Badalona", slug: "badalona" },
    points: 39,
    incidents_count: 5,
  },
  {
    position: 3,
    city: { name: "Lleida", slug: "lleida" },
    points: 31,
    incidents_count: 4,
  },
  {
    position: 4,
    city: { name: "Tarragona", slug: "tarragona" },
    points: 28,
    incidents_count: 3,
  },
  {
    position: 5,
    city: { name: "L'Hospitalet", slug: "lhospitalet" },
    points: 24,
    incidents_count: 4,
  },
];

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 1,
    canonical_title: "Un home resulta ferit per arma blanca a una estació de metro de Barcelona",
    city: { name: "Barcelona", slug: "barcelona" },
    category: "apunyalament",
    points: 12,
    short_neutral_summary: "Un home resulta ferit per arma blanca en una estació de metro a Barcelona.",
    satirical_headline: "Barcelona suma en casa y aprieta el liderato",
    happened_at: "2026-05-19T16:22:00Z",
    sources: [
      { outlet_name: "Betevé", url: "https://beteve.cat" }
    ],
    image_url: publicAsset("images/barcelona_metro.png")
  },
  {
    id: 2,
    canonical_title: "Una baralla multitudinària a Badalona se salda amb dos ferits lleus",
    city: { name: "Badalona", slug: "badalona" },
    category: "pelea",
    points: 8,
    short_neutral_summary: "Pelea entre varios individuos en la vía pública se salda con dos heridos leves.",
    satirical_headline: "Badalona no perdona desde fuera del área",
    happened_at: "2026-05-19T15:55:00Z",
    sources: [
      { outlet_name: "El Caso", url: "https://elcaso.elnacional.cat" }
    ],
    image_url: publicAsset("images/badalona_street.png")
  },
  {
    id: 3,
    canonical_title: "Robatori amb força en un establiment comercial al bell mig de Lleida",
    city: { name: "Lleida", slug: "lleida" },
    category: "robo_violento",
    points: 6,
    short_neutral_summary: "Robo con fuerza en un establecimiento comercial en pleno centro de Lleida.",
    satirical_headline: "Lleida ejecuta un robo al más puro estilo clásico",
    happened_at: "2026-05-19T15:30:00Z",
    sources: [
      { outlet_name: "Segre", url: "https://www.segre.com" }
    ],
    image_url: publicAsset("images/lleida_shop.png")
  },
  {
    id: 4,
    canonical_title: "Una baralla nocturna acaba amb destrosses al mobiliari urbà de Tarragona",
    city: { name: "Tarragona", slug: "tarragona" },
    category: "pelea",
    points: 4,
    short_neutral_summary: "Discusión vecinal termina en agresión en un barrio de Tarragona.",
    satirical_headline: "Tarragona vuelve a la pelea por arriba",
    happened_at: "2026-05-19T14:20:00Z",
    sources: [
      { outlet_name: "Diari de Tarragona", url: "https://www.diaridetarragona.com" }
    ],
    image_url: publicAsset("images/tarragona_alley.png")
  },
  {
    id: 5,
    canonical_title: "Incident d'ordre públic amb aldarulls menors a L'Hospitalet de Llobregat",
    city: { name: "L'Hospitalet", slug: "lhospitalet" },
    category: "pelea",
    points: 8,
    short_neutral_summary: "Pelea multitudinaria en la vía pública de L'Hospitalet de Llobregat.",
    satirical_headline: "L'Hospitalet presiona en campo contrario",
    happened_at: "2026-05-19T17:55:00Z",
    sources: [
      { outlet_name: "El Caso", url: "https://elcaso.elnacional.cat" }
    ],
    image_url: publicAsset("images/badalona_street.png")
  },
  {
    id: 6,
    canonical_title: "Robatori d'algunes ampolles de licor en un supermercat de Girona",
    city: { name: "Girona", slug: "girona" },
    category: "robo_violento",
    points: 4,
    short_neutral_summary: "Un robo con fuerza en un establecimiento de Girona de madrugada.",
    satirical_headline: "Girona entra en la clasificación con robo",
    happened_at: "2026-05-19T17:30:00Z",
    sources: [
      { outlet_name: "Diari de Girona", url: "https://www.diaridegirona.cat" }
    ],
    image_url: publicAsset("images/lleida_shop.png")
  }
];

async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  try {
    const data = await api.get(path).json();
    return schema.parse(data);
  } catch {
    return fallback;
  }
}

export function getRanking(): Promise<CityScore[]> {
  return fetchValidated("/api/ranking/", RankingResponseSchema, MOCK_RANKING);
}

export function getIncidents(): Promise<Incident[]> {
  return fetchValidated("/api/incidents/", IncidentsResponseSchema, MOCK_INCIDENTS);
}
