import { afterEach, describe, expect, it, vi } from "vitest";
import { getGoogleGroundedAnswer, isGoogleGroundingQuestion } from "./googleGrounding";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google Search grounding", () => {
  it("detects current news, sports, weather, and local questions", () => {
    expect(isGoogleGroundingQuestion("ما آخر أخبار العالم اليوم؟")).toBe(true);
    expect(isGoogleGroundingQuestion("ما نتيجة مباراة اليوم؟")).toBe(true);
    expect(isGoogleGroundingQuestion("هل الجو ممطر الآن في طرابزون؟")).toBe(true);
    expect(isGoogleGroundingQuestion("ما معنى الأدب؟")).toBe(false);
  });

  it("does not call Google without a server-side API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getGoogleGroundedAnswer("ما آخر أخبار العالم اليوم؟", "AR")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the grounded answer and verified web source URLs", async () => {
    vi.stubEnv("GEMINI_API_KEY", "server-test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "ملخص حديث معتمد على البحث." }] },
        groundingMetadata: { groundingChunks: [{ web: { title: "مصدر تجريبي", uri: "https://example.com/story" } }] },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getGoogleGroundedAnswer("ما آخر أخبار العالم اليوم؟", "AR");
    expect(result).toContain("ملخص حديث معتمد على البحث.");
    expect(result).toContain("https://example.com/story");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["x-goog-api-key"]).toBe("server-test-key");
  });
});

describe("Google Maps grounding", () => {
  it("detects place-discovery questions", async () => {
    const { isGoogleMapsQuestion } = await import("./googleGrounding");
    expect(isGoogleMapsQuestion("أقرب مستوصف في طرابزون")).toBe(true);
    expect(isGoogleMapsQuestion("Find restaurants near me")).toBe(true);
    expect(isGoogleMapsQuestion("اشرح لي معنى الشعر")).toBe(false);
  });

  it("is disabled by default to avoid unexpected Maps usage charges", async () => {
    const { getGoogleMapsGroundedAnswer } = await import("./googleGrounding");
    vi.stubEnv("GEMINI_API_KEY", "server-test-key");
    vi.stubEnv("ALASSAUL_GOOGLE_MAPS_GROUNDING", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getGoogleMapsGroundedAnswer("أقرب مستوصف في طرابزون", "AR")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns Maps-grounded places only when source URLs are present", async () => {
    const { getGoogleMapsGroundedAnswer } = await import("./googleGrounding");
    vi.stubEnv("GEMINI_API_KEY", "server-test-key");
    vi.stubEnv("ALASSAUL_GOOGLE_MAPS_GROUNDING", "true");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "وجدت مكاناً تجريبياً." }] },
        groundingMetadata: { groundingChunks: [{ maps: { title: "مكان تجريبي", uri: "https://maps.google.com/example" } }] },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getGoogleMapsGroundedAnswer("أقرب مستوصف في طرابزون", "AR");
    expect(result).toContain("وجدت مكاناً تجريبياً.");
    expect(result).toContain("https://maps.google.com/example");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body)).tools).toEqual([{ googleMaps: {} }]);
  });
});
