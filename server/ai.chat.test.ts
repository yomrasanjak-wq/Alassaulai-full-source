import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter, classifyModelProviderFailure, compactChatHistory, collapseRepeatedSpeechText, buildTripGroupDirectionsUrl, extractTripDestination, getAdaptiveTaskInstruction, groupTripPlaces, haversineKm, getDistinctBackupModel, getLiveTripPlacesAnswer, getLiveWeatherAnswer } from "./routers";
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

describe("travel planning accuracy guardrails", () => {
  it("requires verified hotel names and locations instead of guessing", () => {
    const instruction = getAdaptiveTaskInstruction("رتب لي رحلة إلى حائل لمدة ثلاثة أيام");
    expect(instruction).toContain("لا تخترع أسماء فنادق");
    expect(instruction).toContain("مصدر خرائط/مصدر موثوق");
  });
});

describe("speech transcript normalization", () => {
  it("collapses repeated opening phrases from incremental speech recognition", () => {
    const repeated = "طيب ابغى رحلة انا الى الباحه لمده خمس ايام";
    const transcript = Array(7).fill(repeated).concat(["ممكن ترتب لي اياها فين اروح فين اجي"]).join(" ");
    expect(collapseRepeatedSpeechText(transcript)).toBe(`${repeated} ممكن ترتب لي اياها فين اروح فين اجي`);
  });

  it("collapses six copies without retaining a two-copy block", () => {
    const phrase = "رتب لي رحلة في حائل لمدة ثلاثة أيام";
    expect(collapseRepeatedSpeechText(Array(6).fill(phrase).join(" "))).toBe(phrase);
  });

  it("preserves ordinary repeated words and short repeated phrases", () => {
    expect(collapseRepeatedSpeechText("نعم نعم نعم هذا صحيح")).toBe("نعم نعم نعم هذا صحيح");
    expect(collapseRepeatedSpeechText("أريد أريد رحلة قصيرة")).toBe("أريد أريد رحلة قصيرة");
  });

  it("normalizes only user messages in compact chat history", () => {
    const repeated = "رتب لي رحلة في الباحة لمدة خمسة أيام";
    const messages = [
      { role: "user" as const, content: Array(3).fill(repeated).join(" ") },
      { role: "assistant" as const, content: "حاضر حاضر حاضر" },
    ];
    expect(compactChatHistory(messages)[0]?.content).toBe(repeated);
    expect(compactChatHistory(messages)[1]?.content).toBe("حاضر حاضر حاضر");
  });
});

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

describe("trip geography grouping", () => {
  it("calculates approximate great-circle distance and groups nearby mapped places", () => {
    const a = { name: "A", lat: 21.2703, lon: 40.4158 };
    const b = { name: "B", lat: 21.28, lon: 40.42 };
    const c = { name: "C", lat: 21.5, lon: 40.8 };
    expect(haversineKm(a, b)).toBeGreaterThan(0);
    expect(haversineKm(a, b)).toBeLessThan(2);
    expect(groupTripPlaces([a, b, c], 4)).toHaveLength(2);
    expect(groupTripPlaces([a, b, c], 4)[0]).toHaveLength(2);
  });

  it("excludes places with invalid coordinates from route groups", () => {
    const valid = { name: "Valid", lat: 21.27, lon: 40.41 };
    const invalid = { name: "Invalid", lat: Number.NaN, lon: 40.4 };
    expect(groupTripPlaces([valid, invalid])).toEqual([[valid]]);
  });

  it("creates an encoded directions URL with ordered waypoints and no driving-time claim", () => {
    const url = buildTripGroupDirectionsUrl([
      { name: "A & B", lat: 21.1, lon: 40.1 },
      { name: "Middle", lat: 21.2, lon: 40.2 },
      { name: "Last", lat: 21.3, lon: 40.3 },
    ]);
    expect(url).toContain("google.com/maps/dir/");
    expect(url).toContain("waypoints=");
    expect(decodeURIComponent(url ?? "")).toContain("21.2,40.2");
    expect(url).not.toMatch(/\b(?:minutes?|hours?|km)\b/i);
  });

  it("returns no route URL for an empty group", () => {
    expect(buildTripGroupDirectionsUrl([])).toBeUndefined();
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

describe("context-aware follow-up intent", () => {
  it("carries the previous travel request into a short confirmation", () => {
    expect(getContextualTaskMessage([
      { role: "user", content: "رتب لي رحلة يومين في المدينة المنورة" },
      { role: "assistant", content: "إليك برنامجاً مقترحاً" },
      { role: "user", content: "نعم" },
    ])).toContain("رحلة يومين في المدينة المنورة");
  });

  it("carries the previous hotel request into a short distance follow-up", () => {
    expect(getContextualTaskMessage([
      { role: "user", content: "أبغى فنادق بالقرب من المسجد النبوي" },
      { role: "assistant", content: "هذه خيارات تحتاج إلى تحقق" },
      { role: "user", content: "كم تبعد؟" },
    ])).toContain("فنادق بالقرب من المسجد النبوي");
  });

  it("does not replace a complete new question with old context", () => {
    expect(getContextualTaskMessage([
      { role: "user", content: "رتب لي رحلة يومين في المدينة المنورة" },
      { role: "assistant", content: "إليك برنامجاً" },
      { role: "user", content: "ما أبرز أخبار العالم اليوم؟" },
    ])).toBeUndefined();
  });
});

describe("adaptive brain response strategy", () => {
  it("selects safe step-by-step guidance for troubleshooting requests", () => {
    expect(getAdaptiveTaskInstruction("السيارة متعطلة وما تشتغل")).toContain("خطوات تشخيص مرتبة");
  });

  it("selects practical itinerary planning for travel requests", () => {
    expect(getAdaptiveTaskInstruction("رتب لي برنامج 5 أيام في طرابزون وأوزنجول")).toContain("خطة قابلة للتنفيذ");
  });

  it("plans trips for destinations outside North Turkey, including Taif and Al-Baha", () => {
    const taif = getAdaptiveTaskInstruction("رتب لي رحلة ٤ أيام في الطائف");
    const baha = getAdaptiveTaskInstruction("أبغى برنامج سياحي أربعة أيام في الباحة");
    expect(taif).toContain("أي مدينة أو دولة في العالم");
    expect(taif).toContain("رابط بحث خرائط");
    expect(baha).toContain("سؤالاً واحداً محدداً");
    expect(baha).toContain("الطقس والمواسم والإغلاقات");
  });

  it("requires verified dates and live evidence for hotel prices", () => {
    const hotel = getAdaptiveTaskInstruction("طيب كم سعر الليلة بفندق إنتركونتيننتال المدينة؟");
    expect(hotel).toContain("لا تعطِ سعراً تقديرياً");
    expect(hotel).toContain("تاريخ الدخول والخروج");
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


describe("live trip place discovery", () => {
  it("extracts a destination from an Arabic trip-planning request", () => {
    expect(extractTripDestination("رتب لي رحلة ٤ أيام في الطائف")).toBe("الطائف");
    expect(extractTripDestination("أبغى برنامج سياحي في الباحة لمدة 4 أيام")).toBe("الباحة");
    expect(extractTripDestination("ما عاصمة الفلبين؟")).toBeUndefined();
  });

  it("resolves the destination and returns named nearby attractions from OpenStreetMap", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        features: [{
          type: "Feature",
          properties: { name: "Taif", city: "Taif", country: "Saudi Arabia" },
          geometry: { type: "Point", coordinates: [40.4167, 21.2703] },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        elements: [{
          type: "way",
          id: 12345,
          center: { lat: 21.27, lon: 40.42 },
          tags: { name: "Shubra Palace", tourism: "attraction" },
        }],
      }), { status: 200 }));
    try {
      const answer = await getLiveTripPlacesAnswer("رتب لي رحلة ٤ أيام في الطائف");
      expect(answer).toContain("Taif");
      expect(answer).toContain("Shubra Palace");
      expect(answer).toContain("openstreetmap.org/way/12345");
      expect(answer).toContain("ليست تأكيداً لساعات العمل");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1]?.[0]).toContain("overpass-api.de");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("does not fabricate destinations when live geocoding fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network unavailable"));
    try {
      const answer = await getLiveTripPlacesAnswer("رتب لي رحلة يومين في الطائف");
      expect(answer).toContain("تعذر إكمال البحث الجغرافي الحي");
      expect(answer).not.toContain("Shubra Palace");
    } finally {
      fetchSpy.mockRestore();
    }
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
