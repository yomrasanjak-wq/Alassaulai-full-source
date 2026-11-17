/** Context-aware image lookup using Wikimedia Commons and Openverse.
 * Image follow-ups inherit the subject from the visitor's recent conversation.
 */
export type WikimediaImageLanguage = "AR" | "TR" | "EN";
type ChatMessage = { role: "user" | "assistant"; content: string };
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
type OpenverseImage = {
  title?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  indexed_on?: string;
};
type ImageRequest = { title: string; query: string; modern: boolean; googleQuery: string };

function cleanMetadata(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim().slice(0, 180);
}

const imageIntent = /(?:صورة|صوره|صور|الصورة|الصوره|اعرض|أعرض|ورني|ورّني|أرني|ارني|ابغى اشوف|أبغى أشوف|ابي اشوف|أبي أشوف|ابحث في جوجل|ابحث بجوجل|من جوجل|google images|show me|photo|picture|image)/i;
const modernIntent = /(?:حديث|حديثه|حديثة|جديد|جديده|جديدة|ملون|ملونه|ملونة|بالألوان|بالالوان|مو قديم|ليست قديمة|مش قديم|recent|modern|latest|new|color|colour)/i;
const imageComplaint = /(?:كل الصور|الصور.*(?:قديم|قديمة|قديمه)|الصورة.*(?:ما طلعت|ما ظهرت|لم تظهر|ما اشتغلت|ما تحملت|ما تفتح)|(?:ما طلعت|ما ظهرت|لم تظهر).{0,24}(?:الصورة|الصوره))/i;

function knownSubject(text: string): { title: string; query: string } | undefined {
  const rules: Array<[RegExp, string, string]> = [
    [/(?:مطار\s*ريزا|ريزا\s*مطار|مطار\s*ريزه|rize(?:-artvin)?\s*airport|rize\s*havalimani)/i, "مطار ريزا-أرتفين", "Rize Artvin Airport Turkey terminal aerial sea runway"],
    [/(?:حيدر\s*نبي|حيدرنبى|هيدر\s*نبي|هيدرنبى|hidirnebi|hıdırnebi|hidirnebi\s*yaylasi)/i, "مرتفعات حيدر نبي", "Hidirnebi Plateau Trabzon Turkey mountain landscape"],
    [/(?:مياه?.*(?:كبريت|كبيريت).*(?:جرسون|جيرسون|giresun)|(?:جرسون|جيرسون|giresun).*(?:كبريت|kükürt|sulfur))/i, "المياه الكبريتية في منتزه كوزالان – جرسون", "Kuzalan Nature Park Giresun sulfur springs travertines Turkey"],
    [/(?:مكة المكرمة|مكه المكرمه|مكة|مكه|makkah|mecca)/i, "مكة المكرمة والمسجد الحرام", "Masjid al-Haram Mecca Saudi Arabia Kaaba"],
    [/(?:محمد عبده|mohammed abdu|muhammad abdu)/i, "الفنان محمد عبده", "Mohammed Abdu Saudi singer"],
    [/(?:ماجد عبدالله|ماجد عبد الله|majed abdullah|majed abdullah)/i, "اللاعب ماجد عبدالله", "Majed Abdullah Saudi football legend"],
    [/(?:الاتحاد السعودي|نادي الاتحاد|شعار الاتحاد|ittihad|al.?ittihad)/i, "شعار نادي الاتحاد السعودي", "Al Ittihad Saudi football club official crest logo"],
    [/(?:المدينة المنورة|المدينه المنوره|المدينة|المدينه|madinah|medina)/i, "المدينة المنورة", "Al Madinah Al Munawwarah Saudi Arabia Prophet Mosque"],
    [/(?:دمركابي|ديمركابي|demirkapi)/i, "منطقة دمركابي في أوزنجول", "Demirkapi Uzungol Trabzon Turkey"],
    [/(?:أوزنجول|اوزنجول|أوزنقول|اوزنقول|uzung[oö]l|زنجول|زنجود)/i, "أوزنجول", "Uzungol Trabzon lake Turkey"],
  ];
  for (const [pattern, title, query] of rules) {
    if (!pattern.test(text)) continue;
    const asksForBoat = /(?:مركب|قارب|قوارب|مراكب|boat|boats|canoe)/i.test(text);
    return asksForBoat
      ? { title: "قارب بجوار بحيرة أوزنجول", query: "Uzungol lake boat Trabzon Turkey" }
      : { title, query };
  }
  return undefined;
}

function parseStandaloneRequest(message: string): ImageRequest | undefined {
  const text = message.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").trim();
  if (!imageIntent.test(text)) return undefined;
  if (imageComplaint.test(text) && !knownSubject(text)) return undefined;
  const modern = modernIntent.test(text);
  const known = knownSubject(text);
  if (known) return { ...known, modern, googleQuery: known.query + (modern ? " latest recent photos" : "") };

  const query = text
    .replace(/(?:ابحث في جوجل|ابحث بجوجل|من جوجل|صور جوجل|جوجل|google images|من فضلك|لو سمحت|يا اخي|يا أخي|تطلع لي|تطلع|تظهر|ممكن|أبغى|ابغى|أبي|ابي|اعرض لي|أعرض لي|ورني|ورّني|أرني|ارني|ابغى اشوف|أبغى أشوف|صورة|صوره|صور|الصورة|الصوره|حديثة|حديثه|حديث|جديدة|جديده|جديد|ملونة|ملونه|ملون|بالألوان|بالالوان|مو قديم|ليست قديمة|مش قديم|photo|picture|image|show me|recent|modern|latest|new|color|colour)/gi, " ")
    .replace(/[،,.!?؟]+/g, " ").replace(/\s+/g, " ").trim();
  if (query.length < 2) return undefined;
  const title = query.slice(0, 90);
  return { title, query, modern, googleQuery: query + (modern ? " latest recent photos" : "") };
}

function imageRequest(message: string, history: ChatMessage[] = []): ImageRequest | undefined {
  const direct = parseStandaloneRequest(message);
  if (direct?.query) return direct;

  const isContextualFollowup = imageIntent.test(message) || modernIntent.test(message) || imageComplaint.test(message);
  if (!isContextualFollowup) return undefined;
  const previousUsers = history.filter((item) => item.role === "user").slice(-8).reverse();
  for (const previous of previousUsers) {
    const subject = parseStandaloneRequest(previous.content);
    if (subject) {
      const modern = modernIntent.test(message) || imageComplaint.test(message) || subject.modern;
      return { ...subject, modern, googleQuery: subject.query + (modern ? " latest recent photos" : "") };
    }
    const known = knownSubject(previous.content);
    if (known) {
      const modern = modernIntent.test(message) || imageComplaint.test(message);
      return { ...known, modern, googleQuery: known.query + (modern ? " latest recent photos" : "") };
    }
  }
  return undefined;
}

export function isWikimediaImageRequest(message: string, history: ChatMessage[] = []): boolean {
  return Boolean(imageRequest(message, history));
}

function googleImagesUrl(query: string): string {
  return "https://www.google.com/search?tbm=isch&udm=2&tbs=qdr:y&q=" + encodeURIComponent(query);
}

async function searchCommons(request: ImageRequest, signal: AbortSignal) {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: "filetype:bitmap " + request.query,
    gsrnamespace: "6", gsrlimit: "8", prop: "imageinfo", iiprop: "url|mime|extmetadata",
    iiurlwidth: "960", format: "json", formatversion: "2",
  });
  const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
    headers: { accept: "application/json", "user-agent": "ALASSAUL-AI/1.0 (https://alassaul.com; image lookup)" },
    signal,
  });
  if (!response.ok) throw new Error("Wikimedia Commons HTTP " + response.status);
  const data = await response.json() as { query?: { pages?: CommonsPage[] } };
  return (data.query?.pages ?? []).flatMap((page) => {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.thumburl || info?.url || "";
    if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//i.test(imageUrl)) return [];
    if (!/^image\/(?:jpeg|png|webp|gif)$/i.test(info?.mime ?? "")) return [];
    const descriptionUrl = info?.descriptionurl || "";
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(descriptionUrl)) return [];
    return [{
      title: page.title ?? request.title, imageUrl, descriptionUrl,
      license: cleanMetadata(info?.extmetadata?.LicenseShortName?.value),
      artist: cleanMetadata(info?.extmetadata?.Artist?.value),
      credit: cleanMetadata(info?.extmetadata?.Credit?.value),
    }];
  })[0];
}

async function searchOpenverse(request: ImageRequest, signal: AbortSignal): Promise<OpenverseImage | undefined> {
  const params = new URLSearchParams({ q: request.query, page_size: "12", mature: "false" });
  const response = await fetch("https://api.openverse.org/v1/images/?" + params.toString(), {
    headers: { accept: "application/json", "user-agent": "ALASSAUL-AI/1.0 (https://alassaul.com; image lookup)" },
    signal,
  });
  if (!response.ok) throw new Error("Openverse HTTP " + response.status);
  const data = await response.json() as { results?: OpenverseImage[] };
  const results = (data.results ?? []).filter((item) =>
    typeof item.thumbnail === "string"
    && /^https:\/\/api\.openverse\.org\/v1\/images\/[a-f0-9-]+\/thumb\//i.test(item.thumbnail)
    && typeof item.foreign_landing_url === "string"
    && /^https:\/\//i.test(item.foreign_landing_url)
    && typeof item.license === "string"
  );
  if (!results.length) return undefined;
  // Prefer the most recently indexed result, without claiming that its capture date is recent.
  return results.sort((a, b) => Date.parse(b.indexed_on ?? "") - Date.parse(a.indexed_on ?? ""))[0];
}

export async function getWikimediaImageAnswer(
  message: string,
  language: WikimediaImageLanguage = "AR",
  history: ChatMessage[] = [],
): Promise<string | undefined> {
  const request = imageRequest(message, history);
  if (!request) return undefined;
  const googleUrl = googleImagesUrl(request.googleQuery);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4200);
  try {
    // A "modern/recent" request skips the older Commons-first path and uses the broader catalogue.
    if (!request.modern) {
      try {
        const selected = await searchCommons(request, controller.signal);
        if (selected) {
          const source = "[المصدر](" + selected.descriptionUrl + ")";
          return "![" + request.title + "](" + selected.imageUrl + ")\n\n**" + request.title + "** · " + source;
        }
      } catch (error) {
        console.warn("[ALASSAUL image search] Wikimedia Commons unavailable", error);
      }
    }

    try {
      const selected = await searchOpenverse(request, controller.signal);
      if (selected) {
        const source = "[المصدر](" + selected.foreign_landing_url + ")";
        const freshnessNote = request.modern
          ? "\\nملاحظة: تاريخ الفهرسة لا يثبت تاريخ التقاط الصورة؛ لا أصفها بأنها ملتقطة حديثاً دون تاريخ موثوق."
          : "";
        return "![" + request.title + "](" + selected.thumbnail + ")\\n\\n**"
          + request.title + "** · " + source
          + (request.modern ? "\\n\\n[صور Google الحديثة]" + "(" + googleUrl + ")" : "")
          + freshnessNote;
      }
    } catch (error) {
      console.warn("[ALASSAUL image search] Openverse unavailable", error);
    }

    return language === "AR"
      ? "لم أجد صورة يمكنني عرضها بثقة الآن لـ **" + request.title + "**. فتحت لك طريقاً مباشراً إلى [صور Google الحديثة خلال السنة الماضية](" + googleUrl + ") لتظهر لك نتائج أحدث، بدلاً من عرض صورة قديمة على أنها حديثة."
      : "I couldn't verify an image for " + request.title + ". See [recent Google Images results](" + googleUrl + ").";
  } catch (error) {
    console.warn("[ALASSAUL image search] Image providers unavailable", error);
    return language === "AR"
      ? "تعذر جلب الصورة الآن. يمكنك مراجعة [صور Google الحديثة](" + googleUrl + ")، ولن أعرض صورة غير متأكد من صلتها بالطلب."
      : "Image search is temporarily unavailable. See [recent Google Images results](" + googleUrl + ").";
  } finally {
    clearTimeout(timer);
  }
}
