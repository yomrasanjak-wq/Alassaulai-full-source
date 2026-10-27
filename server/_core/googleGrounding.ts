/** Optional real-time search grounding through the official Gemini API.
 * The key is read only on the server and is never returned to the browser.
 */
export type GroundingLanguage = "AR" | "TR" | "EN";

export function isGoogleGroundingQuestion(message: string): boolean {
  return /(?:أخبار|اخبار|خبر عاجل|عاجل|آخر المستجدات|اخر المستجدات|اليوم|الآن|الان|حالي(?:اً|ا)?|نتيجة المباراة|نتائج المباريات|ترتيب الدوري|جدول المباريات|متى يلعب|من فاز|مباراة اليوم|الدوري|روشن|الطقس|الأجواء|الاجواء|مفتوح الآن|مفتوح الان|أقرب|اقرب|حول(?:ي|نا)?|near me|open now|latest|today|current|breaking news|world news|live score|standings|fixtures|weather|nearby)/i.test(message);
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Ask Gemini to decide which Google searches are useful, then return the
 * grounded answer together with the API's supporting web citations.
 */
export async function getGoogleGroundedAnswer(message: string, language: GroundingLanguage): Promise<string | undefined> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !isGoogleGroundingQuestion(message)) return undefined;

  const model = process.env.ALASSAUL_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${message}\n\nأجب باللغة ${language === "AR" ? "العربية" : language === "TR" ? "التركية" : "الإنجليزية"}. استخدم بحث Google المدمج للتحقق من المعلومات المتغيرة. ميّز بين الخبر المؤكد والتحليل، واذكر التواريخ. لا تستنتج أن نتيجة البحث تعني تأكيداً مستقلاً، ولا تخترع تفاصيل أو مصادر.` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });
    if (!response.ok) {
      // Do not include response bodies in errors; they can contain provider metadata.
      throw new Error(`Gemini grounding request failed with HTTP ${response.status}`);
    }
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>;
    };
    const candidate = data.candidates?.[0];
    const answer = (candidate?.content?.parts ?? []).map(part => safeText(part.text)).filter(Boolean).join("\n").trim();
    if (!answer) throw new Error("Gemini grounding returned no answer text");

    const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map(chunk => ({ title: safeText(chunk.web?.title), uri: safeText(chunk.web?.uri) }))
      .filter(source => /^https?:\/\//i.test(source.uri))
      .filter((source, index, all) => all.findIndex(item => item.uri === source.uri) === index)
      .slice(0, 5);
    if (!sources.length) throw new Error("Gemini grounding returned no verifiable web sources");
    const sourceLabel = language === "AR" ? "مصادر البحث" : language === "TR" ? "Arama kaynakları" : "Search sources";
    const citations = sources.length ? `\n\n${sourceLabel}:\n${sources.map((source, index) => `${index + 1}. ${source.title || source.uri}\n   ${source.uri}`).join("\n")}` : "";
    return `${answer}${citations}\n\n${language === "AR" ? "ملاحظة: تحقق من المصدر الأصلي قبل اتخاذ قرار مهم؛ قد تتغير المعلومات." : language === "TR" ? "Not: Önemli kararlar için özgün kaynağı kontrol edin; bilgiler değişebilir." : "Note: Verify the original source before important decisions; information can change."}`;
  } finally {
    clearTimeout(timeout);
  }
}

/** Detect place-discovery requests that benefit from Google Maps data. */
export function isGoogleMapsQuestion(message: string): boolean {
  return /(?:أقرب|اقرب|بالقرب من|قريب من|حول(?:ي|نا)?|مطعم|مطاعم|مقهى|مقاهي|فندق|فنادق|مستشفى|مستوصف|عيادة|صيدلية|ورشة|ميكانيكي|محطة وقود|بنزين|موقف سيارات|مواقف|مكان سياحي|أماكن سياحية|اماكن سياحية|معلم سياحي|ساعات العمل|مفتوح الآن|مفتوح الان|near me|nearby|nearest|restaurants?|cafes?|hotels?|hospital|clinic|pharmacy|mechanic|workshop|gas station|petrol station|parking|tourist attractions?|opening hours|open now)/i.test(message);
}

/** Optional Google Maps grounding. Kept behind an explicit server-side switch
 * because Maps grounding can incur separate usage charges. */
export async function getGoogleMapsGroundedAnswer(message: string, language: GroundingLanguage): Promise<string | undefined> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || process.env.ALASSAUL_GOOGLE_MAPS_GROUNDING !== "true" || !isGoogleMapsQuestion(message)) return undefined;

  // Google documents Maps grounding as English-only at present. Use a clear
  // instruction for internal interpretation, but do not claim it is guaranteed
  // to understand every Arabic place query; only return a result with citations.
  const model = process.env.ALASSAUL_GEMINI_MAPS_MODEL?.trim() || process.env.ALASSAUL_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${message}\n\nUse Google Maps grounding to look up real places and current place details. If the query is not English, interpret it carefully, but do not invent a place or claim opening status unless the Maps result supports it. Respond in ${language === "AR" ? "Arabic" : language === "TR" ? "Turkish" : "English"}. Mention that details and opening hours can change.` }] }],
        tools: [{ googleMaps: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini Maps grounding request failed with HTTP ${response.status}`);
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string }; maps?: { uri?: string; title?: string } }> } }>;
    };
    const candidate = data.candidates?.[0];
    const answer = (candidate?.content?.parts ?? []).map(part => safeText(part.text)).filter(Boolean).join("\n").trim();
    if (!answer) throw new Error("Gemini Maps grounding returned no answer text");
    const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map(chunk => ({ title: safeText(chunk.maps?.title ?? chunk.web?.title), uri: safeText(chunk.maps?.uri ?? chunk.web?.uri) }))
      .filter(source => /^https?:\/\//i.test(source.uri))
      .filter((source, index, all) => all.findIndex(item => item.uri === source.uri) === index)
      .slice(0, 5);
    if (!sources.length) throw new Error("Gemini Maps grounding returned no verifiable place sources");
    const sourceLabel = language === "AR" ? "مصادر الأماكن من Google Maps" : language === "TR" ? "Google Maps yer kaynakları" : "Google Maps place sources";
    const note = language === "AR" ? "ملاحظة: لم أستخدم موقعك الدقيق ما لم تذكره في السؤال؛ تحقق من العنوان وساعات العمل قبل الانطلاق." : language === "TR" ? "Not: Soruda belirtilmedikçe kesin konumunuz kullanılmadı; yola çıkmadan adresi ve çalışma saatlerini doğrulayın." : "Note: Your precise location was not used unless included in your question; verify the address and opening hours before traveling.";
    return `${answer}\n\n${sourceLabel}:\n${sources.map((source, index) => `${index + 1}. ${source.title || source.uri}\n   ${source.uri}`).join("\n")}\n\n${note}`;
  } finally {
    clearTimeout(timeout);
  }
}
