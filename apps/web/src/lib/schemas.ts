import { z } from "zod";

export const CitySchema = z.object({
  name: z.string(),
  slug: z.string(),
  province: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
});

export const PublicCitySchema = CitySchema.extend({
  province: z.string().nullable(),
  aliases: z.array(z.string()),
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
  thumbnail_url: z.string().optional().nullable(),
  image_disclaimer: z.string().optional().nullable(),
});

export const RankingResponseSchema = z.array(CityScoreSchema);
export const CitiesResponseSchema = z.array(PublicCitySchema);
export const IncidentsResponseSchema = z.array(IncidentSchema);

export const PodiumItemSchema = z.object({
  pos: z.number().int(),
  name: z.string(),
  slug: z.string(),
  points: z.number(),
  incidents_count: z.number().int(),
});

export const RoundBriefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  status: z.string(),
});

export const SeasonSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  status: z.string(),
  winner: PodiumItemSchema.nullable(),
  podium: z.array(PodiumItemSchema),
  rounds: z.array(RoundBriefSchema),
});

export const SeasonsResponseSchema = z.array(SeasonSchema);

export type City = z.infer<typeof CitySchema>;
export type PublicCity = z.infer<typeof PublicCitySchema>;

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
  thumbnail_url?: string | null;
  image_disclaimer?: string | null;
};

export type PodiumItem = z.infer<typeof PodiumItemSchema>;
export type RoundBrief = z.infer<typeof RoundBriefSchema>;
export type Season = z.infer<typeof SeasonSchema>;
