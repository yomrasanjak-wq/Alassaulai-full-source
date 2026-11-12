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
    createControlAuditLog: vi.fn().mockResolvedValue({ id: 1 }),
    ensureControlRoomSchema: vi.fn().mockResolvedValue(undefined),
    listControlRequests: vi.fn().mockResolvedValue([]),
    listControlRequestsForAssignee: vi.fn().mockResolvedValue([]),
    listControlTeamMembers: vi.fn().mockResolvedValue([]),
    updateUserRoleByEmail: vi.fn().mockResolvedValue({ id: 2, email: "staff@example.com", role: "secretary" }),
    updateControlRequest: vi.fn().mockResolvedValue({ id: 1, status: "reviewed" }),
  };
});

import { createControlRequest, ensureControlRoomSchema, listControlRequestsForAssignee, updateControlRequest, updateUserRoleByEmail } from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createUserContext(openId: string, role: "user" | "admin" | "secretary" | "assistant" | "it" = "user"): TrpcContext {
  return {
    user: { id: 1, openId, role } as NonNullable<TrpcContext["user"]>,
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
    await expect(caller.control.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.control.update({ id: 1, status: "reviewed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.discovery.upload({ name: "test.jpg", mimeType: "image/jpeg", dataBase64: "YWJjZGVmZ2hpamtsbW5vcA==" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.discovery.update({ id: 1, name: "غير مصرح" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.discovery.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies regular and admin accounts owner-only control actions", async () => {
    const previousOwnerId = ENV.ownerOpenId;
    ENV.ownerOpenId = "platform-owner-open-id";
    try {
      for (const context of [
        createUserContext("ordinary-user-open-id", "user"),
        createUserContext("admin-user-open-id", "admin"),
      ]) {
        const caller = appRouter.createCaller(context);
        await expect(caller.control.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(caller.team.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(caller.control.update({ id: 1, status: "reviewed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(caller.discovery.upload({ name: "test.jpg", mimeType: "image/jpeg", dataBase64: "YWJjZGVmZ2hpamtsbW5vcA==" })).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(caller.discovery.update({ id: 1, name: "غير مصرح" })).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(caller.discovery.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    } finally {
      ENV.ownerOpenId = previousOwnerId;
    }
  });

  it("allows only the configured owner identity into the control room", async () => {
    const previousOwnerId = ENV.ownerOpenId;
    ENV.ownerOpenId = "platform-owner-open-id";
    try {
      const caller = appRouter.createCaller(createUserContext("platform-owner-open-id", "user"));
      await expect(caller.control.list()).resolves.toEqual([]);
    } finally {
      ENV.ownerOpenId = previousOwnerId;
    }
  });

  it("allows only the CEO owner to create assigned department tasks", async () => {
    const previousOwnerId = ENV.ownerOpenId;
    ENV.ownerOpenId = "platform-owner-open-id";
    try {
      const owner = appRouter.createCaller(createUserContext("platform-owner-open-id", "user"));
      await owner.control.createTask({
        title: "متابعة صور الدليل",
        command: "راجع الصور المضافة وتأكد من ظهورها على الهاتف.",
        category: "content",
        priority: "normal",
        assignee: "المساعد",
      });
      expect(vi.mocked(createControlRequest)).toHaveBeenCalledWith(expect.objectContaining({
        requesterType: "owner",
        assignee: "المساعد",
      }));
      const ordinaryUser = appRouter.createCaller(createUserContext("ordinary-user", "user"));
      await expect(ordinaryUser.control.createTask({
        title: "مهمة غير مصرح بها",
        command: "محاولة إنشاء مهمة دون صلاحية المالك.",
        assignee: "IT",
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      ENV.ownerOpenId = previousOwnerId;
    }
  });

  it("allows a secretary to see and update only secretary-assigned tasks", async () => {
    const task = { id: 42, assignee: "السكرتير", status: "pending" };
    vi.mocked(listControlRequestsForAssignee).mockResolvedValue([task as never]);
    const caller = appRouter.createCaller(createUserContext("secretary-open-id", "secretary"));
    await expect(caller.control.list()).resolves.toEqual([task]);
    await caller.control.update({ id: 42, status: "in_progress" });
    expect(vi.mocked(updateControlRequest)).toHaveBeenCalledWith(42, expect.objectContaining({ status: "in_progress" }));
  });

  it("allows IT to submit its assigned work for CEO review but never approve completion", async () => {
    const task = { id: 99, assignee: "IT", status: "in_progress" };
    vi.mocked(listControlRequestsForAssignee).mockResolvedValue([task as never]);
    const caller = appRouter.createCaller(createUserContext("it-open-id", "it"));
    await caller.control.update({ id: 99, status: "ready_for_review" });
    expect(vi.mocked(updateControlRequest)).toHaveBeenCalledWith(99, expect.objectContaining({ status: "ready_for_review" }));
    await expect(caller.control.update({ id: 99, status: "completed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.control.update({ id: 99, status: "in_progress", assignee: "IT" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents the CEO from completing a task that has not entered review", async () => {
    const previousOwnerId = ENV.ownerOpenId;
    ENV.ownerOpenId = "platform-owner-open-id";
    vi.mocked(listControlRequests).mockResolvedValue([{ id: 101, status: "in_progress" } as never]);
    try {
      const owner = appRouter.createCaller(createUserContext("platform-owner-open-id", "user"));
      await expect(owner.control.update({ id: 101, status: "completed" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    } finally {
      ENV.ownerOpenId = previousOwnerId;
    }
  });

  it("applies the additive control-room schema only through the owner team view", async () => {
    const previousOwnerId = ENV.ownerOpenId;
    ENV.ownerOpenId = "platform-owner-open-id";
    try {
      const owner = appRouter.createCaller(createUserContext("platform-owner-open-id", "user"));
      await expect(owner.team.list()).resolves.toEqual([]);
      expect(vi.mocked(ensureControlRoomSchema)).toHaveBeenCalledOnce();
    } finally {
      ENV.ownerOpenId = previousOwnerId;
    }
  });

  it("allows only the owner to assign staff roles", async () => {
    const previousOwnerId = ENV.ownerOpenId;
    ENV.ownerOpenId = "platform-owner-open-id";
    try {
      const owner = appRouter.createCaller(createUserContext("platform-owner-open-id", "user"));
      await owner.team.assignRole({ email: "staff@example.com", role: "secretary" });
      expect(vi.mocked(updateUserRoleByEmail)).toHaveBeenCalledWith("staff@example.com", "secretary");
      const ordinaryUser = appRouter.createCaller(createUserContext("ordinary-user", "user"));
      await expect(ordinaryUser.team.assignRole({ email: "staff@example.com", role: "it" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      ENV.ownerOpenId = previousOwnerId;
    }
  });

  it("allows IT to escalate a security incident to the CEO", async () => {
    const caller = appRouter.createCaller(createUserContext("it-open-id", "it"));
    await caller.control.reportIncident({
      title: "محاولة دخول مشبوهة",
      description: "رُصدت محاولات دخول متكررة على لوحة التحكم.",
      severity: "high",
    });
    expect(vi.mocked(createControlRequest)).toHaveBeenCalledWith(expect.objectContaining({
      requesterType: "it",
      category: "security",
      assignee: "CEO",
      priority: "high",
    }));
  });

  it("does not allow the secretary role to submit IT security incidents", async () => {
    const caller = appRouter.createCaller(createUserContext("secretary-open-id", "secretary"));
    await expect(caller.control.reportIncident({
      title: "بلاغ غير مصرح",
      description: "محاولة اختبار صلاحية غير متاحة.",
      severity: "normal",
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

  it("returns current weather directly without depending on a model response", async () => {
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
      expect(result.text).toContain("الطقس الآن في طرابزون: 20°");
      expect(result.text).toContain("Open-Meteo");
      expect(invokeLLM).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns fresh live news feed results directly without inventing a model summary", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "ملخص صاغه النموذج اعتماداً على العناوين الحية." } }],
    } as never);
    const rss = `<rss><channel><item><title>عنوان تجريبي لأخبار اليوم</title><source>وكالة اختبار</source><link>https://example.com/story</link><pubDate>${new Date(Date.now() - 60 * 60 * 1000).toUTCString()}</pubDate></item></channel></rss>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } }));
    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.ai.chat({ language: "AR", messages: [{ role: "user", content: "ما أبرز أخبار العالم اليوم؟" }] });
      expect(result.text).toContain("عنوان تجريبي لأخبار اليوم");
      expect(invokeLLM).not.toHaveBeenCalled();
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
