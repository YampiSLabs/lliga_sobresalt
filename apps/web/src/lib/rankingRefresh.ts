import type { CityScore } from "./schemas";

export function shouldRefreshInitialRanking(initialRanking: CityScore[]): boolean {
  return initialRanking.length === 0;
}
