import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { synthesizeSpeech } from "./textToSpeech";

describe("Azure Saudi Arabic text-to-speech", () => {
  const originalKey = ENV.azureSpeechKey;
  const originalRegion = ENV.azureSpeechRegion;
  const originalGoogleKey = ENV.googleTtsApiKey;

  afterEach(() => {
    ENV.azureSpeechKey = originalKey;
    ENV.azureSpeechRegion = originalRegion;
    ENV.googleTtsApiKey = originalGoogleKey;
    vi.restoreAllMocks();
  });

  it("uses the HamedNeural Saudi male voice and returns MP3 audio", async () => {
    ENV.azureSpeechKey = "test-secret";
    ENV.azureSpeechRegion = "uaenorth";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } })
    );

    const result = await synthesizeSpeech("أهلاً بك <زائر>", "AR", "male");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("uaenorth.tts.speech.microsoft.com");
    expect((init?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("test-secret");
    expect(String(init?.body)).toContain('name="ar-SA-HamedNeural"');
    expect(String(init?.body)).toContain("&lt;زائر&gt;");
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.allChunks).toHaveLength(1);
    expect(Buffer.from(result.audioContent, "base64")).toEqual(Buffer.from([1, 2, 3]));
  });

  it("uses the Saudi female voice only when the visitor selects it", async () => {
    ENV.azureSpeechKey = "test-secret";
    ENV.azureSpeechRegion = "uaenorth";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([7]), { status: 200 })
    );

    await synthesizeSpeech("مرحباً", "AR", "female");

    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('name="ar-SA-ZariyahNeural"');
  });

  it("keeps the existing Google provider for Turkish and English", async () => {
    ENV.azureSpeechKey = "test-secret";
    ENV.azureSpeechRegion = "uaenorth";
    ENV.googleTtsApiKey = "google-test-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ audioContent: "AQID" }), { status: 200 })
    );

    await synthesizeSpeech("Hello", "EN", "male");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("texttospeech.googleapis.com");
  });
});
