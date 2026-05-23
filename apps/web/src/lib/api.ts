import ky from "ky";
import type { z } from "zod";
import { CitiesResponseSchema, IncidentsResponseSchema, RankingResponseSchema, SeasonsResponseSchema } from "./schemas";
import type { CityScore, Incident, PublicCity, Season } from "./schemas";

const configuredApiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

export const API_BASE_URL = configuredApiBaseUrl || "";

if (!API_BASE_URL && import.meta.env.PROD) {
  throw new Error("PUBLIC_API_BASE_URL must be set for production builds.");
}

const api = ky.create(
  API_BASE_URL
    ? {
        prefix: API_BASE_URL,
        timeout: 5000,
        retry: 1,
      }
    : {
        timeout: 5000,
        retry: 1,
      },
);

const buildFetchCache = new Map<string, Promise<unknown>>();

export function getMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  if (!API_BASE_URL) return url;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${cleanPath}`;
}

async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: T,
  lang?: "ca" | "es" | "en",
  cacheDuringBuild = true,
): Promise<T> {
  const cacheKey = `${lang || "default"}:${path}`;
  if (cacheDuringBuild && import.meta.env.SSR && buildFetchCache.has(cacheKey)) {
    return buildFetchCache.get(cacheKey) as Promise<T>;
  }

  const request = (async () => {
    try {
      const headers = lang ? { "Accept-Language": lang } : undefined;
      const data = await api.get(API_BASE_URL ? path.replace(/^\/+/, "") : path, { headers }).json();
      return schema.parse(data);
    } catch {
      console.warn(`API request failed for ${path}; using empty public response.`);
      return fallback;
    }
  })();

  if (cacheDuringBuild && import.meta.env.SSR) {
    buildFetchCache.set(cacheKey, request);
  }

  return request;
}

export function getRanking(roundId?: number, lang?: "ca" | "es" | "en"): Promise<CityScore[]> {
  const path = roundId ? `/api/ranking/?round_id=${roundId}` : "/api/ranking/";
  return fetchValidated(path, RankingResponseSchema, [], lang, !roundId);
}

export function getCities(lang?: "ca" | "es" | "en"): Promise<PublicCity[]> {
  return fetchValidated("/api/cities/", CitiesResponseSchema, [], lang);
}

export function getIncidents(lang: "ca" | "es" | "en" = "ca"): Promise<Incident[]> {
  return fetchValidated("/api/incidents/", IncidentsResponseSchema, [], lang);
}

export function getSeasons(lang?: "ca" | "es" | "en"): Promise<Season[]> {
  return fetchValidated("/api/seasons/", SeasonsResponseSchema, [], lang);
}
