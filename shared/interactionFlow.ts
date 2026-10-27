import type { LiveStatus } from "./liveStatus";

export function getLiveFrameMode(status: LiveStatus): "iframe" | "stopped" {
  return status === "stopped" ? "stopped" : "iframe";
}

export function getMicrophoneErrorMessage(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "لم يُسمح بالوصول إلى الميكروفون. فعّل إذن الميكروفون من إعدادات المتصفح ثم حاول مرة أخرى.";
  }
  if (error === "no-speech") {
    return "لم أسمع كلاماً واضحاً. تحدث بالعربية بعد الضغط على الميكروفون.";
  }
  if (error === "network") {
    return "تعذر الاتصال بخدمة التعرف الصوتي. اكتب سؤالك أو جرّب الميكروفون مرة أخرى.";
  }
  return "حدثت مشكلة في التعرف الصوتي. جرّب مرة أخرى أو اكتب سؤالك.";
}

function collapseRepeatedSpeech(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  const normalize = (word: string) => word
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[.,،؛:!?؟]+$/g, "");

  for (const word of words) {
    result.push(word);
    // Speech engines sometimes emit the same short phrase several times.
    // Collapse only immediately repeated sequences, preserving the sentence order.
    let changed = true;
    while (changed) {
      changed = false;
      const maxSize = Math.min(8, Math.floor(result.length / 2));
      for (let size = maxSize; size >= 1; size -= 1) {
        const left = result.slice(result.length - size * 2, result.length - size).map(normalize);
        const right = result.slice(result.length - size).map(normalize);
        if (left.every((token, index) => token === right[index])) {
          result.splice(result.length - size, size);
          changed = true;
          break;
        }
      }
    }
  }
  return result.join(" ");
}

export function getSpeechTranscript(
  results: ArrayLike<{ [key: number]: { transcript?: string }; isFinal?: boolean }> | undefined,
  finalOnly = false,
) {
  if (!results || typeof results.length !== "number") return "";
  const transcript = Array.from({ length: results.length }, (_, index) => results[index])
    .filter((result) => result && (!finalOnly || result.isFinal === true))
    .map((result) => result?.[0]?.transcript ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  return collapseRepeatedSpeech(transcript);
}

export function getChatErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();
  if (normalized.includes("429") || normalized.includes("rate limit") || normalized.includes("too many")) {
    return "المساعد مشغول حالياً بسبب كثرة الطلبات. انتظر لحظات ثم أعد إرسال السؤال.";
  }
  if (normalized.includes("401") || normalized.includes("403") || normalized.includes("api key") || normalized.includes("not configured")) {
    return "خدمة الذكاء الاصطناعي غير مهيأة حالياً. يمكن متابعة استخدام البحث والبث، وسيظهر المساعد فور عودة الخدمة.";
  }
  if (normalized.includes("network") || normalized.includes("fetch failed") || normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("502") || normalized.includes("503") || normalized.includes("504") || normalized.includes("llm invoke failed")) {
    return "تعذر الاتصال بخدمة المساعد الآن. تحقق من الاتصال ثم أعد إرسال السؤال، أو جرّب سؤالاً قصيراً.";
  }
  return "لم أتمكن من تجهيز إجابة الآن. أعد إرسال السؤال بصياغة قصيرة، وإذا استمر الخطأ استخدم الكتابة مؤقتاً.";
}
