/** Keyless reference lookup for stable, general-knowledge questions.
 * Uses the official Wikimedia REST search API and returns excerpts with direct source links.
 * This is background reference material, not a substitute for live news or official sources.
 */
export type ReferenceLanguage = "AR" | "TR" | "EN";
const WIKIPEDIA_HOST: Record<ReferenceLanguage, string> = {
  AR: "ar.wikipedia.org", TR: "tr.wikipedia.org", EN: "en.wikipedia.org",
};
const CURRENT_OR_LOCAL_QUERY = /(?:اليوم|الآن|الان|حالياً|حاليا|آخر الأخبار|اخر الاخبار|عاجل|مباشر|نتيجة المباراة|الطقس|درجة الحرارة|مفتوح الآن|مفتوح الان|أقرب|اقرب|بالقرب من|حول(?:ي|نا)?|near me|nearby|open now|today|latest|current|breaking|live score|weather|directions|route)/i;
const INFORMATIONAL_QUESTION = /(?:ما هو|ماهي|ما هي|ما معنى|من هو|من هي|اشرح|فسر|فسّر|لماذا|كيف يعمل|كيف تعمل|متى تأسس|متى تأسست|تعريف|نبذة عن|معلومات عن|what is|who is|explain|meaning of|how does|history of|about)/i;
function cleanExcerpt(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim().slice(0, 420);
}
export function isWikipediaReferenceQuestion(message: string): boolean {
  const normalized = message.normalize("NFKC").trim();
  if (!normalized || normalized.length < 5 || normalized.length > 240) return false;
  if (CURRENT_OR_LOCAL_QUERY.test(normalized)) return false;
  return INFORMATIONAL_QUESTION.test(normalized);
}
export async function getWikipediaSearchContext(message: string, language: ReferenceLanguage): Promise<string | undefined> {
  if (!isWikipediaReferenceQuestion(message)) return undefined;
  const host = WIKIPEDIA_HOST[language];
  const url = new URL(`https://${host}/w/rest.php/v1/search/page`);
  url.search = new URLSearchParams({ q: message.trim(), limit: "3" }).toString();
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "ALASSAUL-AI/1.0 (reference lookup)" },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) throw new Error(`Wikipedia search failed with HTTP ${response.status}`);
    const data = await response.json() as { pages?: Array<{ title?: string; excerpt?: string; description?: string; key?: string }> };
    const pages = (data.pages ?? []).slice(0, 3).filter(page => page.title && page.key);
    if (!pages.length) return undefined;
    return pages.map((page, index) => {
      const title = cleanExcerpt(page.title);
      const excerpt = cleanExcerpt(page.excerpt || page.description);
      const path = String(page.key).split("/").map(encodeURIComponent).join("/");
      return `${index + 1}. ${title}${excerpt ? `: ${excerpt}` : ""}\nالمصدر: https://${host}/wiki/${path}`;
    }).join("\n\n");
  } catch (error) {
    console.warn("[ALASSAUL reference search] Wikipedia unavailable", error);
    return undefined;
  }
}
