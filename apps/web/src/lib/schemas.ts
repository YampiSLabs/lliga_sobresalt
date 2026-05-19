import { z } from "zod";

export const CitySchema = z.object({
  name: z.string(),
  slug: z.string(),
});

export const CityScoreSchema = z.object({
  position: z.number().int().nullable(),
  city: CitySchema,
  points: z.number(),
  incidents_count: z.number().int(),
});

export const SourceSchema = z.object({
  outlet_name: z.string(),
  url: z.string(),
});

export const IncidentSchema = z.object({
  id: z.number().int(),
  canonical_title: z.string(),
  city: CitySchema.nullable(),
  category: z.string(),
  points: z.number(),
  short_neutral_summary: z.string().nullable(),
  satirical_headline: z.string().nullable(),
  happened_at: z.string().nullable(),
  sources: z.array(SourceSchema),
  image_url: z.string().optional().nullable(),
});

export const RankingResponseSchema = z.array(CityScoreSchema);
export const IncidentsResponseSchema = z.array(IncidentSchema);

export type City = {
  name: string;
  slug: string;
};

export type CityScore = {
  position: number | null;
  city: City;
  points: number;
  incidents_count: number;
};

export type Source = {
  outlet_name: string;
  url: string;
};

export type Incident = {
  id: number;
  canonical_title: string;
  city: City | null;
  category: string;
  points: number;
  short_neutral_summary: string | null;
  satirical_headline: string | null;
  happened_at: string | null;
  sources: Source[];
  image_url?: string | null;
};

