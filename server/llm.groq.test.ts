import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isolatedEnvNames = [
  "ALASSAUL_LLM_API_URL", "ALASSAUL_LLM_API_KEY", "OPENAI_BASE_URL", "OPENAI_API_KEY",
  "FORGE_API_URL", "FORGE_API_KEY", "MANUS_API_URL", "MANUS_API_KEY",
  "GROQ_API_URL", "GROQ_API_KEY", "VITE_FRONTEND_FORGE_API_URL", "VITE_FRONTEND_FORGE_API_KEY",
] as const;
const originalEnv = Object.fromEntries(isolatedEnvNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of isolatedEnvNames) delete process.env[name];
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const name of isolatedEnvNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
});

describe("Groq-compatible LLM transport", () => {
  it("does not duplicate /v1 in the chat completions URL", async () => {
    process.env.FORGE_API_URL = "https://api.groq.com/openai/v1";
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await import("./_core/llm");

    await invokeLLM({ messages: [{ role: "user", content: "hello" }] });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("does not retry a non-transient client error", async () => {
    process.env.FORGE_API_URL = "https://api.groq.com/openai/v1";
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await import("./_core/llm");

    await expect(invokeLLM({ messages: [{ role: "user", content: "hello" }] })).rejects.toThrow("400");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
