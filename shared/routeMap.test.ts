import { describe, expect, it } from "vitest";
import { getRouteMapCamera } from "./routeMap";

describe("route map camera", () => {
  it.each([
    ["Trabzon", "يومرا", 40.98065, 39.78875],
    ["Trabzon", "Ordu", 40.9946, 38.79945],
    ["Trabzon", "Samsun", 41.146, 38.02625],
    ["Trabzon", "Rize", 41.0127, 40.12295],
    ["Rize", "Ayder", 40.9864, 40.80825],
    ["Trabzon", "Uzungöl", 40.8125, 40.00915],
    ["Trabzon", "Giresun", 40.95905, 39.056],
    ["Trabzon", "Arsin", 40.97865, 39.82625],
    ["Trabzon", "Sürmene", 40.95565, 39.91925],
    ["Trabzon", "Araklı", 40.97215, 39.89075],
  ])("centers the fallback between %s and %s", (origin, destination, lat, lng) => {
    const { center } = getRouteMapCamera(origin, destination);
    expect(center.lat).toBeCloseTo(lat, 4);
    expect(center.lng).toBeCloseTo(lng, 4);
  });

  it("uses actual Hijaz coordinates for the Jeddah–Yanbu route, not Trabzon", () => {
    const { center, zoom } = getRouteMapCamera("Jeddah", "ينبع");
    expect(center.lat).toBeCloseTo(22.8164, 4);
    expect(center.lng).toBeCloseTo(38.6173, 4);
    expect(center.lat).toBeLessThan(30);
    expect(zoom).toBe(5);
  });

  it("uses the resolved city when only one endpoint is recognized", () => {
    expect(getRouteMapCamera("unknown origin", "أوزنجول").center).toEqual({ lat: 40.6197, lng: 40.2958 });
  });

  it("does not silently substitute Trabzon when both route endpoints are unknown", () => {
    expect(getRouteMapCamera("Unknown City A", "Unknown City B").center).toBeUndefined();
  });
});
