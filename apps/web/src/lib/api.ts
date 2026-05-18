export type CityScore = {
  position: number | null;
  city: { name: string; slug: string };
  points: number;
  incidents_count: number;
};

export type Incident = {
  id: number;
  canonical_title: string;
  city: { name: string; slug: string } | null;
  category: string;
  points: number;
  short_neutral_summary: string | null;
};

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL || "http://localhost:8000";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getRanking(): Promise<CityScore[]> {
  return fetchJson<CityScore[]>("/api/ranking/", []);
}

export function getIncidents(): Promise<Incident[]> {
  return fetchJson<Incident[]>("/api/incidents/", []);
}

