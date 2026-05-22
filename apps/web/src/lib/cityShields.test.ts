import { describe, expect, it } from "vitest";
import { getAvailableCityShieldSlugs, getCityShieldSrc } from "./cityShields";

describe("city shield lookup", () => {
  it("returns shields generated from catalunya-shields assets", () => {
    expect(getCityShieldSrc("sabadell")).toBeTruthy();
    expect(getAvailableCityShieldSlugs()).toContain("sabadell");
  });

  it("keeps legacy alias support for L'Hospitalet", () => {
    expect(getCityShieldSrc("lhospitalet")).toEqual(getCityShieldSrc("lhospitalet-de-llobregat"));
    expect(getCityShieldSrc("l-hospitalet-de-llobregat")).toEqual(getCityShieldSrc("lhospitalet-de-llobregat"));
  });

  it("returns null for unknown municipalities", () => {
    expect(getCityShieldSrc("not-a-real-city")).toBeNull();
  });
});
