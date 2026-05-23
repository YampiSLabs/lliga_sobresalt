import { describe, expect, it } from "vitest";
import {
  getAvailableCities,
  getAvailableCityPageSlugs,
  getAvailableCityShieldSlugs,
  getAvailableCityShields,
  getCityShieldSrc,
} from "./cityShields";

describe("city shield lookup", () => {
  it("returns shields generated from catalunya-shields assets", () => {
    expect(getCityShieldSrc("sabadell")).toBeTruthy();
    expect(getAvailableCityShieldSlugs()).toContain("sabadell");
  });

  it("returns generated municipality names for shield-backed city pages", () => {
    expect(getAvailableCityShields()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Aldover", slug: "aldover", hasShield: true }),
      ]),
    );
  });

  it("returns all catalan municipalities even when a shield has not been downloaded yet", () => {
    expect(getAvailableCities().length).toBeGreaterThan(900);
    expect(getAvailableCities()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Abrera", slug: "abrera", hasShield: false }),
      ]),
    );
  });

  it("creates static city pages for municipalities without downloaded shields", () => {
    expect(getAvailableCityPageSlugs()).toContain("abrera");
    expect(getAvailableCityPageSlugs()).toHaveLength(getAvailableCities().length);
  });

  it("keeps legacy alias support for L'Hospitalet", () => {
    expect(getCityShieldSrc("lhospitalet")).toEqual(getCityShieldSrc("lhospitalet-de-llobregat"));
    expect(getCityShieldSrc("l-hospitalet-de-llobregat")).toEqual(getCityShieldSrc("lhospitalet-de-llobregat"));
  });

  it("returns null for unknown municipalities", () => {
    expect(getCityShieldSrc("not-a-real-city")).toBeNull();
  });
});
