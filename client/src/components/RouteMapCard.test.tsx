// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapBridge = vi.hoisted(() => ({ onMapReady: undefined as ((map: google.maps.Map) => void) | undefined }));
vi.mock("@/components/Map", () => ({
  MapView: (props: { onMapReady?: (map: google.maps.Map) => void }) => {
    mapBridge.onMapReady = props.onMapReady;
    return null;
  },
}));

import { RouteMapCard } from "./RouteMapCard";

afterEach(() => cleanup());

function installGoogleMapsMock() {
  const route = vi.fn();
  const rendererSetMap = vi.fn();
  const rendererSetDirections = vi.fn();
  const clearInstanceListeners = vi.fn();
  class DirectionsService { route = route; }
  class DirectionsRenderer {
    setMap = rendererSetMap;
    setDirections = rendererSetDirections;
  }
  Object.defineProperty(window, "google", {
    configurable: true,
    value: { maps: { DirectionsService, DirectionsRenderer, TravelMode: { DRIVING: "DRIVING" }, event: { clearInstanceListeners } } },
  });
  return { route, rendererSetMap, rendererSetDirections, clearInstanceListeners };
}

describe("RouteMapCard directions lifecycle", () => {
  beforeEach(() => { mapBridge.onMapReady = undefined; });

  it("waits for the actual map instance before creating DirectionsService", async () => {
    const maps = installGoogleMapsMock();
    render(<RouteMapCard origin="Trabzon" destination="Ordu" />);
    expect(maps.route).not.toHaveBeenCalled();

    act(() => mapBridge.onMapReady?.({} as google.maps.Map));
    await waitFor(() => expect(maps.route).toHaveBeenCalledOnce());
    expect(maps.route.mock.calls[0]?.[0]).toMatchObject({
      origin: "Trabzon",
      destination: "Ordu",
      travelMode: "DRIVING",
    });

    maps.route.mock.calls[0]?.[1]({ routes: [{ legs: [{ distance: { text: "200 km" }, duration: { text: "3 hours" } }] }] }, "OK");
    expect(await screen.findByText("200 km")).toBeTruthy();
  });

  it("does not show a route summary when Google Directions fails", async () => {
    const maps = installGoogleMapsMock();
    render(<RouteMapCard origin="Jeddah" destination="Yanbu" />);
    act(() => mapBridge.onMapReady?.({} as google.maps.Map));
    await waitFor(() => expect(maps.route).toHaveBeenCalledOnce());

    act(() => maps.route.mock.calls[0]?.[1](null, "ZERO_RESULTS"));
    expect((await screen.findByRole("status")).textContent).toContain("تعذر رسم الطريق");
    expect(screen.queryByText("المسافة")).toBeNull();
    expect(screen.getByRole("link", { name: /فتح الاتجاهات في Google Maps/ }).getAttribute("href")).toContain("destination=Yanbu");
    expect(maps.rendererSetMap).toHaveBeenCalledWith(null);
    expect(maps.clearInstanceListeners).toHaveBeenCalled();
  });
});
