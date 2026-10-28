import { describe, expect, it } from "vitest";
import { buildDirectionsUrl, parseRouteRequest } from "./routeRequest";

describe("parseRouteRequest", () => {
  it("extracts Hamsiköy from a heavily repeated Arabic voice transcript", () => {
    const text = "انا في طرابزون واريد الذهاب الى انا في طرابزون واريد الذهاب الى انا في طرابزون واريد الذهاب الى همسه انا في طرابزون واريد الذهاب الى همسه كوي انا في طرابزون واريد الذهاب الى همسه كوي ممكن ترسلني على الطريق";
    expect(parseRouteRequest(text)).toEqual({ origin: "Trabzon", destinations: ["Hamsiköy"] });
  });

  it("parses a short route request", () => {
    expect(parseRouteRequest("من طرابزون إلى همسي كوي، افتح الطريق")).toEqual({
      origin: "Trabzon",
      destinations: ["Hamsiköy"],
    });
  });

  it("infers the starting city before the destination in conversational Arabic", () => {
    expect(parseRouteRequest("أنا في طرابزون، ممكن توصلني إلى همسي كوي وافتح الطريق")).toEqual({
      origin: "Trabzon",
      destinations: ["Hamsiköy"],
    });
  });

  it("does not treat ordinary chat as a route request", () => {
    expect(parseRouteRequest("السلام عليكم كيف حالك")).toBeNull();
  });
});

describe("buildDirectionsUrl", () => {
  it("uses only the canonical destination and origin", () => {
    const url = new URL(buildDirectionsUrl("Trabzon", "Hamsiköy"));
    expect(url.searchParams.get("origin")).toBe("Trabzon");
    expect(url.searchParams.get("destination")).toBe("Hamsiköy");
    expect(url.searchParams.get("destination")).not.toContain("انا في");
  });
});
