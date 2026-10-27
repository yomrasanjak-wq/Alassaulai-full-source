import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter, classifyModelProviderFailure, compactChatHistory, getAdaptiveTaskInstruction, getDistinctBackupModel, getLiveWeatherAnswer } from "./routers";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createControlRequest: vi.fn().mockResolvedValue({ id: 77, status: "pending" }),
  };
});

import { createControlRequest } from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("brain governance", () => {
  it("does not expose administrative diagnostics or proposal actions to public visitors", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.brain.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.brain.propose({
      title: "اختبار صلاحيات",
      command: "محاولة إنشاء مقترح من دون جلسة مسؤول.",
      category: "security",
      priority: "normal",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.brain.reviewProposal({
      id: 1,
      decision: "approve",
      note: "اختبار رفض الموافقة دون هوية مالك المنصة.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("forces public control requests to be recorded as visitors", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await caller.control.submit({
      title: "طلب اختبار",
      command: "هذا طلب اختبار من زائر غير مسجل.",
      requesterType: "system",
    } as never);
    expect(vi.mocked(createControlRequest)).toHaveBeenCalledWith(expect.objectContaining({
      title: "طلب اختبار",
      requesterType: "visitor",
    }));
  });
});

describe("model fallback selection", () => {
  it("uses a distinct configured backup model", () => {
    expect(getDistinctBackupModel("primary-model", "backup-model")).toBe("backup-model");
  });

  it("does not retry the same model under different casing or whitespace", () => {
    expect(getDistinctBackupModel(" model-a ", "MODEL-A")).toBeUndefined();
  });

  it("does not invent a backup when the setting is missing", () => {
    expect(getDistinctBackupModel("primary-model", undefined)).toBeUndefined();
  });
});

describe("adaptive brain response strategy", () => {
  it("selects safe step-by-step guidance for troubleshooting requests", () => {
    expect(getAdaptiveTaskInstruction("السيارة متعطلة وما تشتغل")).toContain("خطوات تشخيص مرتبة");
  });

  it("selects practical itinerary planning for travel requests", () => {
    expect(getAdaptiveTaskInstruction("رتب لي برنامج 5 أيام في طرابزون وأوزنجول")).toContain("خطة قابلة للتنفيذ");
  });

  it("selects comparison criteria instead of a generic answer", () => {
    expect(getAdaptiveTaskInstruction("قارن بين السكن في طرابزون وريزه")).toContain("معايير واضحة");
  });

  it("uses health-safety guidance for symptom questions", () => {
    expect(getAdaptiveTaskInstruction("عندي دوخة وش أسوي؟")).toContain("علامات الخطر");
  });

  it("treats world news as time-sensitive and forbids invented current headlines", () => {
    expect(getAdaptiveTaskInstruction("ما أبرز أخبار العالم اليوم؟")).toContain("لا تعرض معلومة على أنها حدث اليوم");
  });
});


describe("live weather source", () => {
  it("uses a live Open-Meteo response for current Trabzon weather", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ current: { time: "2026-10-15T20:00", temperature_2m: 20, apparent_temperature: 21, weather_code: 3, wind_speed_10m: 8 } }), { status: 200, headers: { "content-type": "application/json" } }));
    try {
      const answer = await getLiveWeatherAnswer("ما طقس طرابزون الآن؟");
      expect(answer).toContain("الطقس الآن في طرابزون: 20°");
      expect(answer).toContain("Open-Meteo");
      expect(fetchSpy).toHaveBeenCalledOnce();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("reports live weather failure without inventing current conditions", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network unavailable"));
    try {
      const answer = await getLiveWeatherAnswer("ما طقس طرابزون الآن؟");
      expect(answer).toContain("تعذر التحقق من الطقس الحي");
      expect(answer).not.toContain("20°");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("ai.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invokeLLM).mockRejectedValue(new Error("test provider unavailable"));
  });

  it.each([
    "السلام عليكم",
    "اشرح لي معنى الصبر في القرآن وكيف أطبقه يومياً",
    "لماذا يتكوّن الضباب فوق الجبال صباحاً؟",
    "من أين أبدأ في زيارة ريزا إذا كانت إقامتي ثلاثة أيام؟",
    "ما الفرق بين سيارة هجينة وبلج إن هايبرد للاستخدام داخل المدينة؟",
    "كيف أغيّر موعد تجديد الهوية عبر أبشر؟",
    "ما هي عاصمة الفلبين؟",
  ])("sends new general, religious, geography, tourism, car and daily-service questions to the LLM: %s", async (question) => {
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "إجابة مخصصة وصلت من النموذج اللغوي" } }],
    } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: question }] });

    expect(result).toEqual({ text: "إجابة مخصصة وصلت من النموذج اللغوي" });
    expect(invokeLLM).toHaveBeenCalledOnce();
    const request = vi.mocked(invokeLLM).mock.calls[0]?.[0];
    expect(request?.messages?.at(-1)).toEqual({ role: "user", content: question });
    expect(request?.messages?.[0]?.content).toContain("مساعد ذكاء اصطناعي عام وشامل");
    expect(request?.messages?.[0]?.content).toContain("لا تستبدل الإجابة بترحيب عام أو نص محفوظ");
  });

  it("passes current weather as evidence to the model instead of returning the tool text directly", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "النموذج يشرح قراءة الطقس الحي." } }],
    } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      current: { time: "2026-10-18T11:00", temperature_2m: 19.8, apparent_temperature: 18.5, weather_code: 3, wind_speed_10m: 7 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "ما طقس طرابزون الآن؟" }] });
      expect(result.text).toBe("النموذج يشرح قراءة الطقس الحي.");
      expect(invokeLLM).toHaveBeenCalledOnce();
      expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]?.messages?.[0]?.content).toContain("الطقس الآن في طرابزون: 20°");
      expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]?.messages?.[0]?.content).toContain("Open-Meteo");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("passes live news feed results into the LLM prompt and returns the model's answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "ملخص صاغه النموذج اعتماداً على العناوين الحية." } }],
    } as never);
    const rss = `<rss><channel><item><title>عنوان تجريبي لأخبار اليوم</title><source>وكالة اختبار</source><link>https://example.com/story</link><pubDate>Sun, 18 Oct 2026 07:00:00 GMT</pubDate></item></channel></rss>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } }));
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "ما أبرز أخبار العالم اليوم؟" }] });
      expect(result.text).toBe("ملخص صاغه النموذج اعتماداً على العناوين الحية.");
      expect(invokeLLM).toHaveBeenCalledOnce();
      expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]?.messages?.[0]?.content).toContain("عنوان تجريبي لأخبار اليوم");
      expect(fetchSpy).toHaveBeenCalledOnce();
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("uses a distinct backup model after primary failure", async () => {
    const originalPrimary = ENV.primaryModel;
    const originalBackup = ENV.backupModel;
    ENV.primaryModel = "primary-test-model";
    ENV.backupModel = "backup-test-model";
    vi.mocked(invokeLLM)
      .mockRejectedValueOnce(new Error("provider temporarily unavailable"))
      .mockResolvedValueOnce({ model: "backup-test-model", choices: [{ message: { content: "إجابة احتياطية من النموذج" } }] } as never);
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "اشرح لي مفهوماً جديداً" }] });
      expect(result).toEqual({ text: "إجابة احتياطية من النموذج" });
      expect(invokeLLM).toHaveBeenCalledTimes(2);
      expect(vi.mocked(invokeLLM).mock.calls[1]?.[0]).toMatchObject({ model: "backup-test-model" });
    } finally {
      ENV.primaryModel = originalPrimary;
      ENV.backupModel = originalBackup;
    }
  });

  it("does not retry the same configured model and returns a rate-limit code with a useful message", async () => {
    const originalPrimary = ENV.primaryModel;
    const originalBackup = ENV.backupModel;
    ENV.primaryModel = "same-model";
    ENV.backupModel = " SAME-MODEL ";
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM invoke failed: 429 Too Many Requests"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "ما معنى الأدب؟" }] });
      expect("errorCode" in result && result.errorCode).toBe("rate_limit");
      expect(result.text).toContain("حد الطلبات");
      expect(invokeLLM).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith("[ALASSAUL chat] primary model request failed", expect.objectContaining({ errorCode: "rate_limit", httpStatus: 429 }));
    } finally {
      ENV.primaryModel = originalPrimary;
      ENV.backupModel = originalBackup;
      log.mockRestore();
    }
  });

  it("redacts provider credentials from diagnostics while preserving the failure cause", async () => {
    const originalBackup = ENV.backupModel;
    ENV.backupModel = ENV.primaryModel;
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM invoke failed: 401 Unauthorized Bearer sk-supersecret1234567890"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "اشرح فكرة جديدة" }] });
      expect("errorCode" in result && result.errorCode).toBe("credentials");
      expect(JSON.stringify(log.mock.calls)).not.toContain("sk-supersecret1234567890");
      expect(JSON.stringify(log.mock.calls)).toContain("401");
    } finally {
      ENV.backupModel = originalBackup;
      log.mockRestore();
    }
  });

  it("classifies provider configuration, credentials, quota, timeout and unavailable errors", () => {
    expect(classifyModelProviderFailure(new Error("No language-model API key is configured"))).toBe("configuration");
    expect(classifyModelProviderFailure(new Error("401 invalid API key"))).toBe("credentials");
    expect(classifyModelProviderFailure(new Error("429 rate limit exceeded"))).toBe("rate_limit");
    expect(classifyModelProviderFailure(new Error("Request timed out"))).toBe("timeout");
    expect(classifyModelProviderFailure(new Error("connection reset"))).toBe("unavailable");
  });

  it("tries a distinct backup model when the primary returns a generic placeholder", async () => {
    const originalPrimary = ENV.primaryModel;
    const originalBackup = ENV.backupModel;
    ENV.primaryModel = "primary-placeholder-model";
    ENV.backupModel = "backup-placeholder-model";
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({ model: "primary-placeholder-model", choices: [{ message: { content: "لم أتمكن من الإجابة الآن." } }] } as never)
      .mockResolvedValueOnce({ model: "backup-placeholder-model", choices: [{ message: { content: "إجابة مفيدة من النموذج الاحتياطي" } }] } as never);
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "سؤال جديد غير محفوظ" }] });
      expect(result.text).toBe("إجابة مفيدة من النموذج الاحتياطي");
      expect(invokeLLM).toHaveBeenCalledTimes(2);
    } finally {
      ENV.primaryModel = originalPrimary;
      ENV.backupModel = originalBackup;
    }
  });

  it("does not replace a non-answer from both models with canned content", async () => {
    const originalPrimary = ENV.primaryModel;
    const originalBackup = ENV.backupModel;
    ENV.primaryModel = "primary-empty-model";
    ENV.backupModel = "backup-empty-model";
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({ model: "primary-empty-model", choices: [{ message: { content: "لم أتمكن من تجهيز إجابة الآن." } }] } as never)
      .mockResolvedValueOnce({ model: "backup-empty-model", choices: [{ message: { content: "تعذر تجهيز الرد، حاول لاحقاً." } }] } as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "ما معنى شيء جديد؟" }] });
      expect("errorCode" in result && result.errorCode).toBe("empty_response");
      expect(result.text).toContain("لم يتضمن إجابة مفيدة");
      expect(result.text).not.toContain("أهلاً بك في جدة");
      expect(invokeLLM).toHaveBeenCalledTimes(2);
    } finally {
      ENV.primaryModel = originalPrimary;
      ENV.backupModel = originalBackup;
      log.mockRestore();
    }
  });

  it("forwards an attached image to the model as vision content", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "تظهر في الصورة أشياء يمكنني وصفها." } }],
    } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.ai.chat({
      language: "AR",
      messages: [{ role: "user", content: "ما الذي يظهر في الصورة؟", imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==" }],
    });
    expect(result.text).toContain("تظهر في الصورة");
    expect(vi.mocked(invokeLLM)).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "user", content: expect.arrayContaining([
          expect.objectContaining({ type: "image_url", image_url: expect.objectContaining({ url: "data:image/jpeg;base64,ZmFrZQ==" }) }),
        ]) }),
      ]),
    }));
  });

  it("keeps only recent bounded conversation context", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `${index}-` + "x".repeat(1400),
    }));
    const compacted = compactChatHistory(messages);
    expect(compacted).toHaveLength(8);
    expect(compacted[0]?.content.length).toBe(1200);
    expect(compacted[7]?.content).toBe("x".repeat(1200));
  });
});
