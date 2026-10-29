import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

function createPublicContext(): TrpcContext {
  return { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const caller = () => appRouter.createCaller(createPublicContext());

beforeEach(() => {
  vi.mocked(invokeLLM).mockReset().mockRejectedValue(new Error("provider unavailable"));
});

describe("real-brain regression scenarios", () => {
  it.each([
    ["السلام عليكم", "وعليكم السلام، أهلاً بك. ما السؤال الذي تريد مناقشته؟"],
    ["عند كم درجة يغلي الماء؟", "يغلي الماء قرب 100 درجة مئوية عند مستوى سطح البحر."],
    ["اشرح لي الانكسار الضوئي بمثال من جدة", "مثال الانكسار في الماء يوضح تغير اتجاه الضوء."],
    ["كم المسافة بالسيارة من طرابزون إلى أوردو؟", "المسافة تقريبية، تحقق من خرائط الطريق قبل الانطلاق."],
    ["كيف أغيّر موعد تجديد الهوية عبر أبشر؟", "افتح خدمات أبشر ثم تحقق من خيارات التجديد المتاحة."],
  ])("routes the user's question to the language model: %s", async (question, modelAnswer) => {
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: modelAnswer } }],
    } as never);
    const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: question }] });
    expect(result.text).toBe(modelAnswer);
    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]?.messages?.at(-1)).toEqual({ role: "user", content: question });
  });

  it.each(["لم أتمكن من إجابتك الآن", "لم أتمكن من اجابتك الان"]) (
    "does not show provider placeholder %s as an answer",
    async (placeholder) => {
      const originalPrimary = ENV.primaryModel;
      const originalBackup = ENV.backupModel;
      ENV.primaryModel = "placeholder-primary";
      ENV.backupModel = "placeholder-backup";
      vi.mocked(invokeLLM).mockReset()
        .mockResolvedValueOnce({ model: "placeholder-primary", choices: [{ message: { content: placeholder } }] } as never)
        .mockResolvedValueOnce({ model: "placeholder-backup", choices: [{ message: { content: placeholder } }] } as never);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "اشرح ظاهرة جديدة" }] });
        expect("errorCode" in result && result.errorCode).toBe("empty_response");
        expect(result.text).toContain("لم يتضمن إجابة مفيدة");
        expect(result.text).not.toContain(placeholder);
        expect(invokeLLM).toHaveBeenCalledTimes(2);
      } finally {
        ENV.primaryModel = originalPrimary;
        ENV.backupModel = originalBackup;
        log.mockRestore();
      }
    },
  );

  it("does not substitute a generic Jeddah welcome or answer after model failure", async () => {
    const originalPrimary = ENV.primaryModel;
    const originalBackup = ENV.backupModel;
    ENV.primaryModel = "same-model";
    ENV.backupModel = " SAME-MODEL ";
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM invoke failed: 503 Service Unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "اشرح لي الانكسار الضوئي مع مثال من جدة" }] });
      expect("errorCode" in result && result.errorCode).toBe("unavailable");
      expect(result.text).toContain("تعذر الاتصال بمزود الذكاء الاصطناعي");
      expect(result.text).not.toContain("أهلاً بك في جدة");
      expect(log).toHaveBeenCalledWith("[ALASSAUL chat] primary model request failed", expect.objectContaining({ errorCode: "unavailable", httpStatus: 503 }));
    } finally {
      ENV.primaryModel = originalPrimary;
      ENV.backupModel = originalBackup;
      log.mockRestore();
    }
  });

  it.each([
    "كم المسافة بالسيارة من طرابزون إلى أوردو؟",
    "كم المسافة بالسيارة من جدة إلى ينبع؟",
  ])("does not return a cached route estimate for %s", async (question) => {
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "إجابة أنشأها النموذج عن المسافة مع تنبيه للتحقق من الطريق" } }],
    } as never);
    const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: question }] });
    expect(result.text).toContain("أنشأها النموذج");
    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]?.messages?.at(-1)?.content).toBe(question);
  });

  it("returns a clear RSS outage without relying on the model or inventing current news", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.mocked(invokeLLM).mockResolvedValue({
      model: ENV.primaryModel,
      choices: [{ message: { content: "لا أستطيع تأكيد عناوين اليوم لأن مصدر الأخبار الحي غير متاح." } }],
    } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network unavailable"));
    try {
      const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "ما آخر أخبار كرة القدم اليوم؟" }] });
      expect(result.text).toContain("تعذر جلب عناوين الأخبار الحية");
      expect(result.text).not.toMatch(/فاز|خسر|نتيجة\s+\d/i);
      expect(invokeLLM).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("returns live Qassim weather instead of calling the language model", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ current: { time: "2026-10-29T13:00", temperature_2m: 31, apparent_temperature: 33, weather_code: 0, wind_speed_10m: 12 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "اخبار الطقس في القصيم" }] });
      expect(result.text).toContain("القصيم (بريدة)");
      expect(result.text).toContain("31° مئوية");
      expect(result.text).toContain("Open-Meteo");
      expect(invokeLLM).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("does not present old RSS articles as today's world news", async () => {
    const staleFeed = `<?xml version="1.0"?><rss><channel><item><title>Old world headline</title><source>Example News</source><link>https://example.com/old</link><pubDate>Tue, 01 Jan 2019 10:00:00 GMT</pubDate></item></channel></rss>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(staleFeed, { status: 200, headers: { "content-type": "application/rss+xml" } }),
    );
    try {
      const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "ما أبرز أخبار العالم اليوم؟" }] });
      expect(result.text).toContain("لن أخمّن أخبار اليوم");
      expect(result.text).not.toContain("Old world headline");
      expect(invokeLLM).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });


  it.each([
    ["ما الطقس اليوم في حائل؟", "حائل"],
    ["أبغى الطقس في الطائف", "الطائف"],
    ["ما الجو في ينبع الصناعية؟", "ينبع الصناعية"],
  ])("returns live weather directly for Saudi city question %s", async (question, city) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ current: { time: "2026-10-29T13:00", temperature_2m: 28, apparent_temperature: 30, weather_code: 1, wind_speed_10m: 9 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: question }] });
      expect(result.text).toContain(city);
      expect(result.text).toContain("28° مئوية");
      expect(result.text).toContain("Open-Meteo");
      expect(invokeLLM).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("answers Roshn League news using Saudi-league search results, never Turkish league guesses", async () => {
    const rss = `<rss><channel><item><title>أخبار دوري روشن السعودي اليوم</title><source>وكالة اختبار</source><link>https://example.com/saudi-league</link><pubDate>${new Date(Date.now() - 60 * 60 * 1000).toUTCString()}</pubDate></item></channel></rss>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      expect(new URL(url).searchParams.get("q")).toContain("دوري روشن السعودي");
      return new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    try {
      const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "أريد أخبار الدوري روشن" }] });
      expect(result.text).toContain("أحدث أخبار دوري روشن السعودي");
      expect(result.text).toContain("أخبار دوري روشن السعودي اليوم");
      expect(result.text).not.toMatch(/الدوري التركي|غلطة سراي|فنربخشة/i);
      expect(invokeLLM).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });


  it("offers a useful Trabzon itinerary if both AI providers fail", async () => {
    const result = await caller().ai.chat({ language: "AR", messages: [{ role: "user", content: "رتب لي برنامجاً في طرابزون" }] });
    expect(result.text).toContain("قصر أتاتورك");
    expect(result.text).toContain("غانيتا");
    expect(result.text).toContain("ليس تحققاً من الطقس");
    expect(invokeLLM).toHaveBeenCalled();
  });

  it("offers a real map search instead of inventing breakfast restaurants after provider failure", async () => {
    const result = await caller().ai.chat({
      language: "AR",
      messages: [
        { role: "user", content: "أريد مطعماً قريباً في ينبع الصناعية حي الصبح" },
        { role: "assistant", content: "حاضر، هل تفضل نوعاً معيناً؟" },
        { role: "user", content: "أبغى مطعم فطور" },
      ],
    });
    expect(result.text).toContain("مطاعم فطور في ينبع الصناعية");
    expect(result.text).toContain("https://www.google.com/maps/search/");
    expect(result.text).not.toMatch(/مطعم\s+[\p{L}]+\s+(?:ممتاز|مفتوح الآن)|تقييمه\s+\d/i);
    expect(invokeLLM).toHaveBeenCalled();
  });

});
