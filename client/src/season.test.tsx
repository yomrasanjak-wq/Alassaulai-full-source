import { describe, expect, it } from "vitest";
import { getSeason } from "@shared/season";

describe("seasonal background selection", () => {
  it("maps the calendar months to the four seasons", () => {
    expect(getSeason(new Date(2026, 2, 1))).toBe("spring");
    expect(getSeason(new Date(2026, 5, 1))).toBe("summer");
    expect(getSeason(new Date(2026, 8, 1))).toBe("autumn");
    expect(getSeason(new Date(2026, 11, 1))).toBe("winter");
  });
});
