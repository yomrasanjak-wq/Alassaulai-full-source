import { afterEach, describe, expect, it, vi } from "vitest";

const envNames = [
  "ALASSAUL_LLM_API_URL",
  "ALASSAUL_LLM_API_KEY",
  "OPENAI_API_KEY",
  "ALASSAUL_PRIMARY_MODEL",
  "ALASSAUL_BACKUP_MODEL",
  "FORGE_API_URL",
  "FORGE_API_KEY",
  "MANUS_API_URL",
  "MANUS_API_KEY",
  "GROQ_API_URL",
  "GROQ_API_KEY",
  "OPENAI_BASE_URL",
] as const;
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

afterEach(() => {
  vi.unstubAllGlobals();
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
});

describe("Responses API transport", () => {
  it("uses the configured Responses endpoint and extracts nested text when output_text is empty", async () => {
    process.env.ALASSAUL_LLM_API_URL = "https://example.netlify.app/.netlify/ai/v1/responses";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ALASSAUL_PRIMARY_MODEL = "test-model";

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "resp_test",
      model: "test-model",
      output_text: "",
      output: [{
        type: "message",
        content: [{ type: "output_text", text: "تم استخراج الإجابة من المحتوى الداخلي." }],
      }],
      usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await import("./_core/llm");

    const result = await invokeLLM({ messages: [{ role: "user", content: "اختبار" }] });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.netlify.app/.netlify/ai/v1/responses");
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({ model: "test-model", input: [{ role: "user", content: [{ type: "input_text", text: "اختبار" }] }] });
    expect(result.choices[0]?.message.content).toBe("تم استخراج الإجابة من المحتوى الداخلي.");
    expect(result.usage).toMatchObject({ prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 });
  });
});
