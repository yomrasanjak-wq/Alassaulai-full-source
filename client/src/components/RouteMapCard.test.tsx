// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapBridge = vi.hoisted(() => ({ onMapReady: undefined as ((map: { leafletMap: any }) => void) | undefined }));
vi.mock("@/components/Map", () => ({
  MapView: (props: { onMapReady?: (map: { leafletMap: any }) => void }) => {
    mapBridge.onMapReady = props.onMapReady;
    return null;
  },
}));

import { RouteMapCard } from "./RouteMapCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RouteMapCard free Leaflet/OSRM route lifecycle", () => {
  let leafletMap: { removeLayer: ReturnType<typeof vi.fn>; fitBounds: ReturnType<typeof vi.fn> };
  let polyline: ReturnType<typeof vi.fn>;
  let layer: { addTo: ReturnType<typeof vi.fn>; getBounds: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mapBridge.onMapReady = undefined;
    leafletMap = { removeLayer: vi.fn(), fitBounds: vi.fn() };
    layer = { addTo: vi.fn(), getBounds: vi.fn(() => "route-bounds") };
    polyline = vi.fn(() => layer);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{
          distance: 200000,
          duration: 10800,
          geometry: { coordinates: [[39.72, 41.0], [38.0, 40.9]] },
        }],
      }),
    }));
    Object.defineProperty(window, "L", { configurable: true, value: { polyline } });
  });

  it("requests and draws a verified route after the Leaflet map is ready", async () => {
    render(<RouteMapCard origin="Trabzon" destination="Ordu" />);
    expect(fetch).not.toHaveBeenCalled();

    act(() => mapBridge.onMapReady?.({ leafletMap }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("39.7225,41.0053;37.8764,40.9839");
    await waitFor(() => expect(screen.getByText("200.0 كم")).toBeTruthy());
    expect(screen.getByText("3 س 0 د")).toBeTruthy();
    expect(polyline).toHaveBeenCalledOnce();
    expect(layer.addTo).toHaveBeenCalledWith(leafletMap);
    expect(leafletMap.fitBounds).toHaveBeenCalledWith("route-bounds", { padding: [28, 28], maxZoom: 12 });
  });

  it("shows a clear fallback when the free routing service fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<RouteMapCard origin="Jeddah" destination="Yanbu" />);
    act(() => mapBridge.onMapReady?.({ leafletMap }));
    expect((await screen.findByRole("status")).textContent).toContain("تعذر رسم الطريق");
    expect(screen.queryByText("المسافة")).toBeNull();
    expect(screen.getByRole("link", { name: /فتح الاتجاهات في Google Maps/ }).getAttribute("href")).toContain("destination=Yanbu");
  });

  it("does not leave an endless loading state when coordinates are unknown", async () => {
    render(<RouteMapCard origin="مدينة غير معروفة" destination="وجهة غير معروفة" />);
    act(() => mapBridge.onMapReady?.({ leafletMap }));
    expect((await screen.findByRole("status")).textContent).toContain("لا تتوفر إحداثيات موثقة");
    expect(fetch).not.toHaveBeenCalled();
  });
});
