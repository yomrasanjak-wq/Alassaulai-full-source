/** Fast, license-aware image lookup through Wikimedia Commons.
 * Only direct Wikimedia upload URLs are returned for rendering in chat.
 */
export type WikimediaImageLanguage = "AR" | "TR" | "EN";

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

function cleanMetadata(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function imageRequest(message: string): { title: string; query: string } | undefined {
  const text = message.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").trim();
  if (!/(?:صورة|صوره|صور|اعرض|أعرض|ورني|ورّني|أرني|ارني|ابغى اشوف|أبغى أشوف|ابي اشوف|أبي أشوف|show me|photo|picture|image)/i.test(text)) return undefined;

  if (/(?:مكة المكرمة|مكه المكرمه|مكة|مكه|makkah|mecca)/i.test(text)) {
    return { title: "مكة المكرمة والمسجد الحرام", query: "Masjid al-Haram Mecca Kaaba" };
  }
  if (/(?:محمد عبده|mohammed abdu|muhammad abdu)/i.test(text)) {
    return { title: "الفنان محمد عبده", query: '"Mohammed Abdu" Saudi singer' };
  }
  if (/(?:أوزنجول|اوزنجول|أوزنقول|اوزنقول|uzung[oö]l|زنجول|زنجود)/i.test(text)) {
    return { title: "أوزنجول", query: "Uzungol Trabzon lake" };
  }

  const query = text
    .replace(/(?:من فضلك|لو سمحت|ممكن|أبغى|ابغى|أبي|ابي|اعرض لي|أعرض لي|ورني|ورّني|أرني|ارني|صورة|صوره|صور|photo|picture|image|show me)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return query.length >= 2 ? { title: query.slice(0, 90), query } : undefined;
}

export function isWikimediaImageRequest(message: string): boolean {
  return Boolean(imageRequest(message));
}

export async function getWikimediaImageAnswer(
  message: string,
  language: WikimediaImageLanguage = "AR",
): Promise<string | undefined> {
  const request = imageRequest(message);
  if (!request) return undefined;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: "filetype:bitmap " + request.query,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "960",
    format: "json",
    formatversion: "2",
  });

  try {
    const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
      headers: {
        accept: "application/json",
        "user-agent": "ALASSAUL-AI/1.0 (https://alassaul.com; image lookup)",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error("Wikimedia Commons returned HTTP " + response.status);

    const data = await response.json() as { query?: { pages?: CommonsPage[] } };
    const pages = data.query?.pages ?? [];
    const candidates = pages.flatMap((page) => {
      const info = page.imageinfo?.[0];
      const imageUrl = info?.thumburl || info?.url || "";
      if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//i.test(imageUrl)) return [];
      if (!/^image\/(?:jpeg|png|webp|gif)$/i.test(info?.mime ?? "")) return [];
      const descriptionUrl = info?.descriptionurl || "";
      if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(descriptionUrl)) return [];
      const license = cleanMetadata(info?.extmetadata?.LicenseShortName?.value);
      const artist = cleanMetadata(info?.extmetadata?.Artist?.value);
      const credit = cleanMetadata(info?.extmetadata?.Credit?.value);
      return [{ title: page.title ?? request.title, imageUrl, descriptionUrl, license, artist, credit }];
    });

    const selected = candidates[0];
    if (!selected) {
      const searchUrl = "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=" + encodeURIComponent(request.query);
      return language === "AR"
        ? "بحثت في مكتبة ويكيميديا عن صورة موثوقة لـ **" + request.title + "**، لكن لم أجد ملفاً مناسباً يمكنني عرضه بثقة الآن. يمكنك فتح [نتائج الصور ومراجعة المصدر](" + searchUrl + ")."
        : "I couldn't find a suitable verified image for " + request.title + ". See the [Wikimedia Commons image results](" + searchUrl + ").";
    }

    const alt = request.title.replace(/[\[\]\r\n]/g, " ").slice(0, 140);
    const attribution = [
      selected.artist ? "المصور/صاحب العمل: " + selected.artist : "",
      selected.credit && selected.credit !== selected.artist ? "الاعتماد: " + selected.credit : "",
      selected.license ? "الترخيص: " + selected.license : "",
    ].filter(Boolean).join(" · ");
    const source = "[صفحة الصورة ومصدرها" + (selected.license ? " — " + selected.license : "") + "](" + selected.descriptionUrl + ")";
    return "تفضل، هذه صورة **" + request.title + "**:\n\n!["
      + alt + "](" + selected.imageUrl + ")\n\n"
      + (attribution ? attribution + "\n" : "") + source;
  } catch (error) {
    console.warn("[ALASSAUL image search] Wikimedia Commons unavailable", error);
    const searchUrl = "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=" + encodeURIComponent(request.query);
    return language === "AR"
      ? "تعذر تحميل صورة **" + request.title + "** مباشرة الآن. يمكنك رؤية [نتائج الصور في مكتبة ويكيميديا](" + searchUrl + ")، ولن أعرض صورة غير متأكد من صلتها بالطلب."
      : "Image search is temporarily unavailable. See [Wikimedia Commons](" + searchUrl + ").";
  }
}
