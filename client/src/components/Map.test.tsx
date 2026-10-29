// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MapView } from "./Map";

describe("MapView", () => {
  it("exports the current Leaflet map component", () => {
    expect(typeof MapView).toBe("function");
  });
});
