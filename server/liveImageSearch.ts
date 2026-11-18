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

function normalizeImageText(value: string): string {
  return value.normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

const imageIntent = /(?:صورة|صوره|صور|الصورة|الصوره|اعرض|أعرض|ورني|ورّني|أرني|ارني|منظر|مناظر|مشهد|مشاهد|ابغى اشوف|أبغى أشوف|ابي اشوف|أبي أشوف|ابحث في جوجل|ابحث بجوجل|من جوجل|google images|show me|photo|picture|image)/i;
const modernIntent = /(?:حديث|حديثه|حديثة|جديد|جديده|جديدة|ملون|ملونه|ملونة|بالألوان|بالالوان|مو قديم|ليست قديمة|مش قديم|جمال|منظر|مناظر|طبيعة|ساحل|recent|modern|latest|new|color|colour|scenic)/i;
const imageComplaint = /(?:كل الصور|الصور.*(?:قديم|قديمة|قديمه)|الصورة.*(?:ما طلعت|ما ظهرت|لم تظهر|ما اشتغلت|ما تحملت|ما تفتح)|(?:ما طلعت|ما ظهرت|لم تظهر).{0,24}(?:الصورة|الصوره))/i;

function knownSubject(text: string): { title: string; query: string } | undefined {
  const normalized = normalizeImageText(text);
  if (/(?:محمد عبده|mohammed abdu|muhammad abdu)/i.test(normalized)
    && /(?:لاعب|كره القدم|كوره|نادي|football|player|club)/i.test(normalized)) {
    return { title: "اللاعب محمد عبده", query: "Mohammed Abdu Saudi football player" };
  }
  const rules: Array<[RegExp, string, string]> = [
    [/(?:الميدان|ميدان طرابزون|trabzon meydan|meydan square)/i, "ميدان طرابزون", "Trabzon Meydan Square city center Turkey"],
    [/(?:ال)?همس(?:ي|ه)?\s*كوي|(?:ال)?همس(?:ي|ه)?كوي|hamsik[oö]y|hamse\s*koy/i, "همسي كوي", "Hamsikoy Trabzon Turkey village mountain landscape"],
    [/(?:ساكويا|ساكيويا|سيكويا|sequoia|toyota sequoia)/i, "تويوتا ساكويا 2010", "2010 Toyota Sequoia SUV exterior"],
    [/(?:باقة ورد|باقه ورد|ورد جميل|bouquet|flower bouquet)/i, "باقة ورد جميلة", "beautiful fresh flower bouquet roses colorful flowers"],
    [/(?:طرابزون|ترابزون|trabzon)/i, "طرابزون – مشاهد المدينة والساحل", "Trabzon Turkey Black Sea coast city skyline modern scenic view"],
    [/(?:مطار\s*ريزا|ريزا\s*مطار|مطار\s*ريزه|rize(?:-artvin)?\s*airport|rize\s*havalimani)/i, "مطار ريزا-أرتفين", "Rize Artvin Airport Turkey terminal aerial sea runway"],
    [/(?:حيدر\s*نبي|حيدرنبى|هيدر\s*نبي|هيدرنبى|hidirnebi|hıdırnebi|hidirnebi\s*yaylasi)/i, "مرتفعات حيدر نبي", "Hidirnebi Plateau Trabzon Turkey mountain landscape"],
    [/(?:مياه?.*(?:كبريت|كبيريت).*(?:جرسون|جيرسون|giresun)|(?:جرسون|جيرسون|giresun).*(?:كبريت|kükürt|sulfur))/i, "المياه الكبريتية في منتزه كوزالان – جرسون", "Kuzalan Nature Park Giresun sulfur springs travertines Turkey"],
    [/(?:مكة المكرمة|مكه المكرمه|مكة|مكه|makkah|mecca)/i, "مكة المكرمة والمسجد الحرام", "Masjid al-Haram Mecca Saudi Arabia Kaaba"],
    [/(?:محمد نور|mohammed noor|mohammad noor|mohamed noor)/i, "اللاعب محمد نور نجم الاتحاد السابق", "Mohammed Noor Saudi footballer Al Ittihad legend"],
    [/(?:محمد علي سندي|محمد على سندي|mohammed ali sindi|muhammad ali sindi)/i, "الفنان محمد علي سندي", "Mohammed Ali Sindi Saudi singer"],
    [/(?:محمد عبده|mohammed abdu|muhammad abdu)/i, "الفنان محمد عبده", "Mohammed Abdu Saudi singer"],
    [/(?:ماجد عبدالله|ماجد عبد الله|majed abdullah|majed abdullah)/i, "اللاعب ماجد عبدالله", "Majed Abdullah Saudi football legend"],
    [/(?:الاتحاد السعودي|نادي الاتحاد|شعار الاتحاد|ittihad|al.?ittihad)/i, "شعار نادي الاتحاد السعودي", "Al Ittihad Saudi football club official crest logo"],
    [/(?:المدينة المنورة|المدينه المنوره|المدينة|المدينه|madinah|medina)/i, "المدينة المنورة", "Al Madinah Al Munawwarah Saudi Arabia Prophet Mosque"],
    [/(?:دمركابي|ديمركابي|demirkapi)/i, "منطقة دمركابي في أوزنجول", "Demirkapi Uzungol Trabzon Turkey"],
    [/(?:أوزنجول|اوزنجول|أوزنقول|اوزنقول|uzung[oö]l|زنجول|زنجود)/i, "أوزنجول", "Uzungol Trabzon lake Turkey"],
  ];
  for (const [pattern, title, query] of rules) {
    if (!pattern.test(normalized)) continue;
    const asksForBoat = /(?:مركب|قارب|قوارب|مراكب|boat|boats|canoe)/i.test(text);
    return asksForBoat
      ? { title: "قارب بجوار بحيرة أوزنجول", query: "Uzungol lake boat Trabzon Turkey" }
      : { title, query };
  }
  return undefined;
}

function parseStandaloneRequest(message: string): ImageRequest | undefined {
  const text = normalizeImageText(message);
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

function hasExplicitNewImageSubject(message: string): boolean {
  const remainder = normalizeImageText(message)
    .replace(/(?:اعرض|ورني|ارني|ابغى|ابي|ممكن|صوره|صورة|صور|الصوره|الصورة|منظر|مناظر|مشهد|مشاهد|جمال|طبيعه|ساحل|حديث|حديثه|حديثة|جديد|جديده|جديدة|ملون|ملونه|ملونه|بالالوان|بالالوان|photo|picture|image|show me|please|من فضلك|لو سمحت|يا اخي|يا اخي|تطلع|تظهر|لي|عن|ل|في|من|على|هذه|هذي|كل|الصور|قديمة|قديمه|قديم|ما|لم|طلعت|ظهرت|اشتغلت|ثانيه|ثانية|اخرى|أخرى|نفس|المكان|الموقع|كمان|ايضا|أيضا)/gi, " ")
    .replace(/[،,.!?؟]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return remainder.length > 0;
}

function imageRequest(message: string, history: ChatMessage[] = []): ImageRequest | undefined {
  const direct = parseStandaloneRequest(message);
  if (direct?.query) return direct;

  // A fresh, named subject must never inherit a different subject from older turns.
  // Only generic follow-ups (e.g. "show another", "these images are old") may inherit.
  if (hasExplicitNewImageSubject(message)) return undefined;
  const isContextualFollowup = imageIntent.test(message) || imageComplaint.test(message);
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
  const pages = data.query?.pages ?? [];
  const query = request.query.toLowerCase();
  const identityTerms = query.split(/[^a-z0-9]+/i).filter((word) =>
    word.length > 3 && !/^(turkey|saudi|arabia|football|player|legend|landscape|terminal|aerial|runway|coast|scenic|modern|city|center|square|view|photos|photo|black|sea)$/i.test(word)
  );
  const rejectedTitle = /(?:\bmap\b|\batlas\b|\bchart\b|\bdiagram\b|\bpostcard\b|\bengraving\b|\b lithograph\b|\b186[0-9]\b|\b19[0-4][0-9]\b)/i;
  const candidates = pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.url || info?.thumburl || "";
    const title = page.title ?? "";
    if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//i.test(imageUrl)) return [];
    if (!/^image\/(?:jpeg|png|webp|gif)$/i.test(info?.mime ?? "")) return [];
    const descriptionUrl = info?.descriptionurl || "";
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(descriptionUrl)) return [];
    if (rejectedTitle.test(title)) return [];
    const normalizedTitle = title.toLowerCase();
    const matchedTerms = identityTerms.filter((term) => normalizedTitle.includes(term));
    // Reject unrelated Commons search hits (for example, an old regional map for a city-photo request).
    if (identityTerms.length && !matchedTerms.length) return [];
    return [{
      title, imageUrl, descriptionUrl,
      score: matchedTerms.length,
      license: cleanMetadata(info?.extmetadata?.LicenseShortName?.value),
      artist: cleanMetadata(info?.extmetadata?.Artist?.value),
      credit: cleanMetadata(info?.extmetadata?.Credit?.value),
    }];
  });
  return candidates.sort((left, right) => right.score - left.score)[0];
}

async function searchWikipedia(request: ImageRequest, signal: AbortSignal): Promise<{ title: string; imageUrl: string; pageUrl: string } | undefined> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: request.query,
    gsrnamespace: "0",
    gsrlimit: "8",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "960",
    inprop: "url",
    format: "json",
    formatversion: "2",
  });
  const response = await fetch("https://en.wikipedia.org/w/api.php?" + params.toString(), {
    headers: { accept: "application/json", "user-agent": "ALASSAUL-AI/1.0 (https://alassaul.com; image lookup)" },
    signal,
  });
  if (!response.ok) throw new Error("Wikipedia image search HTTP " + response.status);
  const data = await response.json() as { query?: { pages?: Array<{ title?: string; fullurl?: string; thumbnail?: { source?: string } }> } };
  const pages = data.query?.pages ?? [];
  const candidates = pages.flatMap((page) => {
    const imageUrl = page.thumbnail?.source ?? "";
    const pageUrl = page.fullurl ?? "";
    if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\//i.test(imageUrl)) return [];
    if (!/\.(?:jpe?g|png|webp)$/i.test(imageUrl.split(/[?#]/, 1)[0])) return [];
    if (!/^https:\/\/en\.wikipedia\.org\/wiki\//i.test(pageUrl)) return [];
    return [{ title: page.title ?? request.title, imageUrl, pageUrl }];
  });
  return candidates[0];
}

async function searchOpenverse(request: ImageRequest, signal: AbortSignal): Promise<OpenverseImage | undefined> {
  const params = new URLSearchParams({ q: request.query, page_size: "12", mature: "false" });
  const response = await fetch("https://api.openverse.org/v1/images/?" + params.toString(), {
    headers: { accept: "application/json", "user-agent": "ALASSAUL-AI/1.0 (https://alassaul.com; image lookup)" },
    signal,
  });
  if (!response.ok) throw new Error("Openverse HTTP " + response.status);
  const data = await response.json() as { results?: OpenverseImage[] };
  const stopWords = new Set(["turkey", "saudi", "arabia", "the", "and", "for", "with", "view", "photo", "photos", "image", "images", "modern", "recent", "latest", "scenic", "city", "landscape", "trabzon", "hamsikoy", "mecca", "madinah", "sequoia", "toyota", "bouquet", "beautiful", "flowers", "flower"]);
  // Openverse titles are commonly English. Never compare Arabic query tokens with English titles.
  const terms = request.query
    .split(/[^a-z0-9]+/i)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 2 && !stopWords.has(word));
  const results = (data.results ?? []).flatMap((item) => {
    if (typeof item.thumbnail !== "string"
      || !/^https:\/\/api\.openverse\.org\/v1\/images\/[a-f0-9-]+\/thumb\//i.test(item.thumbnail)
      || typeof item.foreign_landing_url !== "string"
      || !/^https:\/\//i.test(item.foreign_landing_url)
      || typeof item.license !== "string"
      || typeof item.title !== "string") return [];
    const title = cleanMetadata(item.title);
    const normalizedTitle = normalizeImageText(title);
    const relevance = terms.filter((term) => normalizedTitle.includes(term)).length;
    // Openverse already ranks by the query; keep safe candidates even when titles
    // use a different language, while preferring any exact subject-word matches.
    return [{ ...item, title, relevance }];
  });
  if (!results.length) return undefined;
  // Relevance comes first; indexing date is only a tie-breaker, not proof of capture date.
  return results.sort((a, b) =>
    b.relevance - a.relevance
    || Date.parse(b.indexed_on ?? "") - Date.parse(a.indexed_on ?? "")
  )[0];
}

export async function getWikimediaImageAnswer(
  message: string,
  language: WikimediaImageLanguage = "AR",
  history: ChatMessage[] = [],
): Promise<string | undefined> {
  const request = imageRequest(message, history);
  if (!request) return undefined;
  const googleUrl = googleImagesUrl(request.googleQuery);
  try {
    // Search three independent image indexes at the same time. A slow provider
    // must not consume the time budget of the others.
    const commonsController = new AbortController();
    const openverseController = new AbortController();
    const wikipediaController = new AbortController();
    const commonsTimer = setTimeout(() => commonsController.abort(), 6500);
    const openverseTimer = setTimeout(() => openverseController.abort(), 6500);
    const wikipediaTimer = setTimeout(() => wikipediaController.abort(), 6500);
    const [commonsResult, openverseResult, wikipediaResult] = await Promise.allSettled([
      request.modern
        ? Promise.resolve(undefined)
        : searchCommons(request, commonsController.signal),
      searchOpenverse(request, openverseController.signal),
      searchWikipedia(request, wikipediaController.signal),
    ]);
    clearTimeout(commonsTimer);
    clearTimeout(openverseTimer);
    clearTimeout(wikipediaTimer);

    if (commonsResult.status === "fulfilled" && commonsResult.value) {
      const selected = commonsResult.value;
      const source = "[المصدر](" + selected.descriptionUrl + ")";
      return "![" + request.title + "](" + selected.imageUrl + ")\n\n**" + request.title + "** · " + source;
    }
    if (commonsResult.status === "rejected") {
      console.warn("[ALASSAUL image search] Wikimedia Commons unavailable", commonsResult.reason);
    }

    if (openverseResult.status === "fulfilled" && openverseResult.value) {
      const selected = openverseResult.value;
      const source = "[المصدر](" + selected.foreign_landing_url + ")";
      const freshnessNote = request.modern
        ? "\nملاحظة: تاريخ الفهرسة لا يثبت تاريخ التقاط الصورة؛ لا أصفها بأنها ملتقطة حديثاً دون تاريخ موثوق."
        : "";
      return "![" + request.title + "](" + selected.thumbnail + ")\n\n**"
        + request.title + "** · " + source
        + (request.modern ? "\n\n[صور Google الحديثة]" + "(" + googleUrl + ")" : "")
        + freshnessNote;
    }
    if (openverseResult.status === "rejected") {
      console.warn("[ALASSAUL image search] Openverse unavailable", openverseResult.reason);
    }

    if (wikipediaResult.status === "fulfilled" && wikipediaResult.value) {
      const selected = wikipediaResult.value;
      return "![" + request.title + "](" + selected.imageUrl + ")\n\n**"
        + request.title + "** · [المصدر](" + selected.pageUrl + ")";
    }
    if (wikipediaResult.status === "rejected") {
      console.warn("[ALASSAUL image search] Wikipedia unavailable", wikipediaResult.reason);
    }

    return language === "AR"
      ? "لم أجد صورة مناسبة الآن. جرّب بعد قليل."
      : "I couldn't verify an image for " + request.title + ". See [recent Google Images results](" + googleUrl + ").";
  } catch (error) {
    console.warn("[ALASSAUL image search] Image providers unavailable", error);
    return language === "AR"
      ? "تعذر جلب الصورة الآن. حاول بعد قليل."
      : "Image search is temporarily unavailable. See [recent Google Images results](" + googleUrl + ").";
  }
}
