import { describe, expect, it } from "vitest";
import { buildGlobalSearchUrl, buildNearbySearchUrl } from "./globalSearch";

describe("global search URL helpers", () => {
  it("opens a web search for a trimmed Arabic query", () => {
    expect(buildGlobalSearchUrl("  مستشفى في جدة  ")).toBe(
      "https://www.google.com/search?q=%D9%85%D8%B3%D8%AA%D8%B4%D9%81%D9%89%20%D9%81%D9%8A%20%D8%AC%D8%AF%D8%A9",
    );
  });

  it("opens a map search without changing the requested place", () => {
    expect(buildGlobalSearchUrl("Yomra Marina", "maps")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Yomra%20Marina",
    );
  });

  it("rejects an empty global query", () => {
    expect(() => buildGlobalSearchUrl("   ")).toThrow("Search query must not be empty.");
  });

  it("uses the requested search term and rounded coordinates for nearby search", () => {
    expect(buildNearbySearchUrl("صيدلية", 21.54321, 39.17284)).toBe(
      "https://www.google.com/maps/search/?api=1&query=%D8%B5%D9%8A%D8%AF%D9%84%D9%8A%D8%A9%20near%2021.54321%2C39.17284",
    );
  });

  it("uses a safe default term when nearby search is blank", () => {
    expect(buildNearbySearchUrl("", 0, 0)).toContain(encodeURIComponent("أماكن وخدمات near 0.00000,0.00000"));
  });

  it("rejects coordinates outside geographic bounds", () => {
    expect(() => buildNearbySearchUrl("", 91, 0)).toThrow(RangeError);
    expect(() => buildNearbySearchUrl("", 0, 181)).toThrow(RangeError);
    expect(() => buildNearbySearchUrl("", Number.NaN, 0)).toThrow(RangeError);
  });
});
