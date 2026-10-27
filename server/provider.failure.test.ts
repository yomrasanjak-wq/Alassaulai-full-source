import { describe, expect, it, vi } from "vitest";
import { appRouter, classifyModelProviderFailure } from "./routers";
import { invokeLLM } from "./_core/llm";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

function createPublicContext(): TrpcContext {
  return { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("provider failure communication", () => {
  it.each([
    [new Error("No language-model API key is configured"), "configuration"],
    [new Error("LLM invoke failed: 429 Too Many Requests"), "rate_limit"],
    [new DOMException("The operation timed out", "TimeoutError"), "timeout"],
    [new Error("LLM invoke failed: 401 Unauthorized"), "credentials"],
  ])("classifies %s without exposing raw provider details", (error, expected) => {
    expect(classifyModelProviderFailure(error)).toBe(expected);
  });

  it.each([
    [new Error("No language-model API key is configured"), "مفتاح مزود الذكاء الاصطناعي غير مضبوط"],
    [new Error("LLM invoke failed: 429 Too Many Requests"), "حد الطلبات مؤقتاً"],
    [new DOMException("The operation timed out", "TimeoutError"), "انتهت مهلة الاتصال"],
  ])("returns a specific Arabic next step for %s", async (error, expected) => {
    vi.mocked(invokeLLM).mockReset().mockRejectedValue(error);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "اشرح لي ظاهرة علمية" }] });
    expect(result.text).toContain(expected);
    expect(result.text).not.toContain(error.message);
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });
});
