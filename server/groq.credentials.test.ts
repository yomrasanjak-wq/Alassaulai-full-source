import { describe, expect, it } from "vitest";

const shouldRunLiveSmoke = process.env.RUN_PROVIDER_SMOKE_TEST === "true";
const apiUrl = (process.env.FORGE_API_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const apiKey = process.env.GROQ_API_KEY || process.env.FORGE_API_KEY || "";

describe("optional Groq provider smoke check", () => {
  it.skipIf(!shouldRunLiveSmoke || !apiKey)("authenticates against the lightweight models endpoint", async () => {
    const response = await fetch(`${apiUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await response.text();
    expect(response.ok, `Groq models endpoint returned ${response.status}: ${body.slice(0, 300)}`).toBe(true);
  }, 15_000);
});
