import { describe, expect, it } from "vitest";
import { buildOfflineItineraryFallback } from "./itineraryFallback";

describe("buildOfflineItineraryFallback", () => {
  it("keeps a Saudi–Istanbul–Trabzon–Istanbul itinerary useful for four people during an API outage", () => {
    const answer = buildOfflineItineraryFallback([
      { role: "user", content: "نحن اربع اشخاص واريد ان تجهز لي رحله من السعوديه الى اسطنبول يومين وبعدها الى طرابزون ثلاث ايام ثم الى اسطنبول يومين ثم نرجع الى جده السعوديه" },
    ], "AR");

    expect(answer).toContain("لأربعة أشخاص");
    expect(answer).toContain("الأيام 1–2 | إسطنبول");
    expect(answer).toContain("الأيام 3–5 | طرابزون");
    expect(answer).toContain("الأيام 6–7 | إسطنبول والعودة");
    expect(answer).toContain("جدة");
    expect(answer).not.toContain("سعر التذكرة");
  });

  it("provides a practical three-day Trabzon plan when the visitor gives no duration", () => {
    const answer = buildOfflineItineraryFallback([
      { role: "user", content: "رتب لي برنامجاً في طرابزون" },
    ], "AR");

    expect(answer).toContain("اليوم الأول | طرابزون المدينة");
    expect(answer).toContain("اليوم الثاني | أوزنجول والطبيعة");
    expect(answer).toContain("اليوم الثالث | سوميلا وزيغانا");
  });

  it("does not turn ordinary chat or unsupported languages into an itinerary", () => {
    expect(buildOfflineItineraryFallback([{ role: "user", content: "السلام عليكم" }], "AR")).toBeUndefined();
    expect(buildOfflineItineraryFallback([{ role: "user", content: "Plan a trip to Trabzon" }], "EN")).toBeUndefined();
  });
});
