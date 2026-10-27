import { describe, expect, it } from "vitest";
import { getLiveStatusLabel } from "./liveStatus";

describe("live status flow", () => {
  it("labels every broadcast state for the in-platform modal", () => {
    expect(getLiveStatusLabel("loading")).toBe("جاري التحميل");
    expect(getLiveStatusLabel("ready")).toBe("يعمل الآن");
    expect(getLiveStatusLabel("stopped")).toBe("متوقف");
    expect(getLiveStatusLabel("unavailable")).toBe("المصدر غير متاح");
  });
});
