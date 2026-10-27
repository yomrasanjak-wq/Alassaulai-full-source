import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

function createPublicContext(): TrpcContext {
  return { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("health-related model guidance", () => {
  it("routes dizziness and clinic questions to the model with safe-triage guidance", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "الدوخة لها أسباب متعددة ولا يمكن تشخيصها عن بعد. اجلس وتجنب القيادة، واطلب الرعاية العاجلة إذا ظهرت علامات خطر. للعثور على عيادة، أرسل الحي أو افتح بحث الخرائط." } }],
    } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const question = "عندي دوخة وأريد أراجع عيادة في طرابزون";
    const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: question }] });
    expect(result.text).toContain("لا يمكن تشخيصها عن بعد");
    expect(vi.mocked(invokeLLM)).toHaveBeenCalledOnce();
    const request = vi.mocked(invokeLLM).mock.calls[0]?.[0];
    expect(request?.messages?.at(-1)).toEqual({ role: "user", content: question });
    expect(request?.messages?.[0]?.content).toContain("علامات الخطر");
    expect(request?.messages?.[0]?.content).toContain("نمط معلومات صحية");
  });
});
