import { describe, expect, it } from "vitest";
import { shouldRefreshInitialRanking } from "./rankingRefresh";

describe("ranking refresh", () => {
  it("refreshes on client load when static ranking payload is empty", () => {
    expect(shouldRefreshInitialRanking([])).toBe(true);
  });

  it("keeps static ranking payload when build already has rows", () => {
    expect(
      shouldRefreshInitialRanking([
        {
          position: 1,
          city: { name: "Reus", slug: "reus" },
          points: 48.75,
          incidents_count: 2,
        },
      ]),
    ).toBe(false);
  });
});
