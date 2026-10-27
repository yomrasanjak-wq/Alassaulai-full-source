// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildMapScriptUrl } from "./Map";

describe("Google Maps proxy configuration", () => {
  it("never builds a script URL with an undefined or blank key", () => {
    expect(() => buildMapScriptUrl(undefined, "https://forge.example.test")).toThrow("Missing VITE_FRONTEND_FORGE_API_KEY");
    expect(() => buildMapScriptUrl("   ", "https://forge.example.test")).toThrow("Missing VITE_FRONTEND_FORGE_API_KEY");
  });

  it("uses the frontend key only in the configured Maps proxy URL", () => {
    const url = new URL(buildMapScriptUrl("public-map-key", "https://forge.example.test/"));
    expect(url.origin).toBe("https://forge.example.test");
    expect(url.pathname).toBe("/v1/maps/proxy/maps/api/js");
    expect(url.searchParams.get("key")).toBe("public-map-key");
  });

  it("rejects insecure public proxy URLs outside localhost", () => {
    expect(() => buildMapScriptUrl("public-map-key", "http://forge.example.test")).toThrow("must use HTTPS");
  });
});
