import { ENV } from "./_core/env";
import { COOKIE_NAME } from "@shared/const";
import { countRegisteredVisitors, createControlRequest, createGuestMemory, createMediaItem, deleteGuestMemory, deleteMediaItem, listControlRequests, listGuestMemories, listMediaItems, updateControlRequest, updateMediaItem } from "./db";
import { storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { getGoogleGroundedAnswer, getGoogleMapsGroundedAnswer, isGoogleGroundingQuestion, isGoogleMapsQuestion } from "./_core/googleGrounding";
import { synthesizeSpeech } from "./_core/textToSpeech";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, ownerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().max(4000).default(""),
  imageDataUrl: z.string().max(4_600_000).regex(/^data:image\/(?:jpeg|png|webp);base64,/i).optional(),
}).superRefine((message, context) => {
  if (!message.content && !message.imageDataUrl) {
    context.addIssue({ code: "custom", message: "اكتب سؤالاً أو أرفق صورة." });
  }
});

const languageSchema = z.enum(["AR", "TR", "EN"]).default("AR");

const assistantSystemPrompt = `أنت مساعد ذكاء اصطناعي عام وشامل داخل منصة ALASSAUL-AI، ولست محصوراً في السفر أو بيانات المنصة. أجب عن أي سؤال عام آمن: المعرفة العامة، التعليم، العلوم، التاريخ، الجغرافيا، التقنية، الكتابة، الترجمة، التخطيط، السفر، الرياضة، الثقافة، السيارات، والخدمات اليومية. استخدم بيانات المنصة أولاً عندما يكون السؤال عن مدن الشمال التركي أو خدمات ALASSAUL، ثم استخدم معرفتك العامة الكاملة لبقية الأسئلة. افهم المقصود حتى مع اللهجة الخليجية والأخطاء الإملائية والصياغة المختصرة، ولا تجعل عدم وجود السؤال في قاعدة بيانات محلية سبباً للرفض. أجب بالعربية الطبيعية الواضحة ما لم يطلب المستخدم لغة أخرى. كن ودوداً ومحترماً وابدأ بجواب مباشر مفيد. لا تقل «أنا متخصص فقط» ولا «لا أستطيع مساعدتك لأن السؤال خارج نطاقي»، ولا تعتذر اعتذاراً آلياً؛ إذا كانت المعلومة متغيرة أو تحتاج تاريخاً فاذكر ذلك واطلب التفاصيل اللازمة، وإذا لم تكن متأكداً فصرّح بعدم اليقين بدل اختلاق معلومة. في الطلبات الطبية والقانونية والمالية قدّم معلومات عامة عملية مع تنبيه مختصر لمختص عند الحاجة. في الإجراءات الحكومية والرسوم والمواعيد، لا تسرد متطلبات أو خطوات محددة على أنها مؤكدة إلا إذا دعمتها نتيجة موثوقة من مصدر رسمي؛ وإلا وجّه المستخدم إلى القناة الرسمية ووضّح ما يحتاج إلى تحقق. ارفض فقط الطلبات الضارة أو غير القانونية مع اقتراح بديل آمن.

قواعد السرعة والجودة:
- اجعل الإجابة مباشرة ومناسبة لصندوق محادثة: عادةً 2 إلى 5 جمل قصيرة وبحدود 140 كلمة. لا تحوّل سؤالاً بسيطاً إلى دليل طويل؛ استخدم نقاطاً قليلة فقط عندما يطلب المستخدم خطة أو خطوات، وتجنب الجداول الطويلة.
- افهم نية المستخدم: إن كان يريد تعريفاً فعرّف، وإن كان يريد مقارنة فقارن، وإن كان يريد خطة فاقترح خطوات عملية، وإن كان يريد رأياً فاذكر المزايا والقيود بوضوح.
- إذا كان السؤال غامضاً، قدم أفضل تفسير معقول أولاً ثم اسأل سؤال توضيح واحداً فقط.
- في الأخبار والسياسة والأحداث المتغيرة، نبّه إلى الحاجة للتحقق الحديث ولا تخترع أرقاماً أو مصادر. إذا لم تتوفر أداة بحث حي في الطلب الحالي، قل بوضوح إنك لا تستطيع تأكيد آخر الأخبار الآن، واذكر التاريخ المرجعي عند اللزوم.
- إذا أرفق المستخدم صورة، حلّل العناصر الظاهرة بدقة، وميّز بين ما تراه فعلاً وما تستنتجه. لا تجزم بهوية شخص أو مكان من صورة وحدها، ولا تستنتج صفات حساسة. إذا كانت الصورة غير واضحة فاطلب لقطة أوضح.
- في الدين ميّز بين المعلومة العامة والفتوى المتخصصة، وفي الطب والقانون والمال قدّم معلومات عامة فقط مع تنبيه لمختص.
- ارفض الطلب الضار أو غير القانوني بلطف، ولا تدّعي تنفيذ حجز أو معاملة لم تُنفّذ.
`;

const MAX_CHAT_HISTORY = 8;
const MAX_CHAT_MESSAGE_CHARS = 1200;

/** Return a backup model only when it is genuinely different from the primary.
 * Repeating the same model after a failure wastes latency and provider quota. */
export function getDistinctBackupModel(primaryModel: string | undefined, backupModel: string | undefined): string | undefined {
  const primary = primaryModel?.trim();
  const backup = backupModel?.trim();
  if (!backup || !primary || backup.toLocaleLowerCase() === primary.toLocaleLowerCase()) return undefined;
  return backup;
}

/** Select a response strategy from the user's intent instead of treating every
 * prompt as the same generic chat request. This changes guidance only; it does
 * not grant tools or authority to perform external actions. */
export function getAdaptiveTaskInstruction(message: string): string {
  const text = message.normalize("NFKC").toLowerCase();
  if (/(أخبار العالم|اخبار العالم|آخر الأخبار|اخر الاخبار|الأخبار اليوم|الاخبار اليوم|خبر عاجل|عاجل|ماذا يحدث في العالم|أخبار اليوم|اخبار اليوم|latest news|world news|breaking news)/i.test(text)) {
    return "نمط الأخبار: الأخبار تتغير بسرعة؛ لا تعرض معلومة على أنها حدث اليوم ما لم تتوفر نتيجة بحث حديثة موثوقة. افصل بين الخبر المؤكد والخلفية والتحليل، واذكر تاريخ الخبر ومصدره إذا كانا متاحين. إذا لم تتوفر لديك أداة بحث حي في هذه الجلسة، صرّح بذلك بوضوح واطلب من المستخدم رابط الخبر أو حدّد ما يمكنك شرحه من الخلفية دون اختلاق عناوين أو أرقام.";
  }
  if (/(كيف أصلح|كيف اصلح|متعطل|عطل|لا يعمل|ما يشتغل|ما يفتح|خطأ|مشكلة|حل المشكلة|تشخيص)/i.test(text)) {
    return "نمط معالجة مشكلة: حدّد الاحتمال الأقرب دون الجزم، ثم أعطِ خطوات تشخيص مرتبة من الأبسط والأكثر أماناً إلى المتقدم. اذكر ما ينبغي عدم فعله، واسأل عن معلومة واحدة فقط إذا كانت ضرورية.";
  }
  if (/(رتب لي|برنامج|خطة|جدول|خطط|نظم|نظّم|رحلة|بكج|ميزانية|خلال \d+ أيام)/i.test(text)) {
    const itinerary = "نمط التخطيط: قدّم خطة قابلة للتنفيذ بترتيب زمني واضح، وراعِ المسافات والوقت والتكلفة التقريبية والبدائل. إذا ذكر المستخدم عدد الأشخاص والمدن وترتيبها ومدة كل محطة، التزم بها كما هي، واحسب الأيام بوضوح ولا تضف مدناً غير مطلوبة. اجمع الوجهات المتقاربة في اليوم نفسه، وتجنب وضع زيارات بعيدة في اليوم نفسه. لا تدّعِ حجزاً أو توافراً أو سعراً حالياً لم تتحقق منه، وبيّن الافتراضات المهمة.";
    if (/(طرابزون|ترابزون|أوزنجول|اوزنجول|أيدر|ايدر|ريزه|سامسون|أوردو|جيرسون|إسطنبول|اسطنبول|شمال تركيا|سورميني|أراكلي)/i.test(text)) {
      return `${itinerary} خصّص الخطة لشمال تركيا: اجمع الوجهات المتقاربة في اليوم نفسه، وراعِ وقت القيادة والطقس الجبلي، وضمّن عند ملاءمة المسار سامسون وأوردو وجيرسون وأرسين وسورميني وأراكلي وإسطنبول، ولا تضعها كلها في مسار واحد إن كان الوقت لا يسمح.`;
    }
    return itinerary;
  }
  if (/(قارن|الفرق بين|أيهما أفضل|ايهما افضل|وش الأفضل|ما الأفضل|مميزات|عيوب)/i.test(text)) {
    return "نمط المقارنة: قارن الخيارات على معايير واضحة، واذكر المزايا والقيود، ثم أعطِ توصية مشروطة بحسب حاجة المستخدم بدلاً من إعلان فائز مطلق.";
  }
  if (/(اشرح|فسر|فسّر|لماذا|ليش|كيف يحدث|ما معنى|ما هو|ماهي|ما هي|عرّف|عرف)/i.test(text)) {
    return "نمط الشرح: ابدأ بالخلاصة البسيطة، ثم اشرح السبب أو الآلية بمثال ملموس. عرّف المصطلحات الضرورية فقط ولا تملأ الإجابة بحشو.";
  }
  if (/(اكتب|صغ|صياغة|ترجم|لخص|لخّص|رسالة|خطاب|إعلان|اعلان|منشور|قصة|قصيدة)/i.test(text)) {
    return "نمط الإنتاج: أنشئ النص المطلوب مباشرة وبالصيغة المناسبة، واحفظ المعنى والنبرة المطلوبة. لا تكتفِ بشرح كيفية كتابته، ولا تضف ادعاءات أو تفاصيل لم يذكرها المستخدم.";
  }
  if (/(مشاكل? أسرية|مشاكل? عائلية|خلافات? زوجية|زوجي|زوجتي|زوجها|زوجها|زوجها|طلاق|انفصال|أبنائي|ابنائي|أولادي|اولادي|عقوق|قطيعة رحم|خلاف مع الأهل|مشاكل بين الإخوة|مشاكل بين الاخوة|family problem|marital conflict|relationship advice)/i.test(text)) {
    return "نمط إرشاد أسري: استمع دون لوم أو انحياز، وميّز بين الوقائع والتوقعات والمشاعر. قدّم خطوات هادئة قابلة للتطبيق وصياغة مقترحة للحوار، واسأل سؤال توضيح واحداً إذا لزم. لا تشخّص الأشخاص ولا تدفع إلى قرار مصيري من رواية واحدة. إذا ظهر عنف أو تهديد أو خطر على طفل، أعطِ الأولوية للسلامة واطلب مساعدة محلية موثوقة أو مختصاً.";
  }
  if (/(طيران|طيارة|طائرة|الملاحة الجوية|الفضاء|الكون|الثقوب السوداء|ناسا|NASA|astronomy|aviation|space exploration|black hole)/i.test(text)) {
    return "نمط علوم الطيران والفضاء: اشرح المفهوم علمياً وبأسلوب مفهوم، وميّز بين الحقائق الراسخة والنظريات والفرضيات. في أخبار المهمات الفضائية أو الرحلات أو الاكتشافات الحديثة، استخدم مصدراً حديثاً إن توفر ولا تعرض التوقعات كأنها نتائج مؤكدة.";
  }
  if (/(نتائج? المباريات|نتيجة المباراة|الدوري السعودي|دوري روشن|الدوري الأوروبي|دوري أبطال أوروبا|دوري ابطال اوروبا|كأس العالم|كاس العالم|مباراة اليوم|جدول المباريات|ترتيب الدوري|من فاز|live score|football results|league standings)/i.test(text)) {
    return "نمط الرياضة الحية: حدّد البطولة والفريق والتاريخ المقصود. استخدم سياق البحث الحي إذا توفر، واذكر النتيجة وحالة المباراة وتاريخ التحديث والمصدر. لا تخمّن نتيجة مباشرة أو جدولاً من الذاكرة؛ إذا لم تتوفر بيانات موثوقة فقل ذلك صراحة.";
  }
  if (/(صحة|طبي|دوخة|دوخه|ألم|الم|دواء|علاج|أعراض|اعراض|مستوصف|مستشفى|طوارئ)/i.test(text)) {
    return "نمط معلومات صحية: ابدأ بإرشاد آمن ومحدد، فرّق بين المعلومات العامة والتشخيص، ونبّه بوضوح إلى علامات الخطر التي تستلزم رعاية عاجلة. لا تصف دواءً أو جرعة على أساس معلومات ناقصة.";
  }
  if (/(طرابزون|ترابزون|أوزنجول|اوزنجول|أيدر|ايدر|ريزه|سامسون|أوردو|جيرسون|إسطنبول|اسطنبول|شمال تركيا|سورميني|أراكلي)/i.test(text)) {
    return "نمط دليل شمال تركيا: قدّم اقتراحات عملية تراعي الموقع والمسافة والموسم، وميّز بين المعلومات العامة والطقس أو الأسعار أو المواعيد التي تتطلب تحققاً حياً. لا تحصر التوصية في طرابزون وحدها إذا كان نطاق السؤال أوسع.";
  }
  return "نمط الإجابة العامة: حدّد المطلوب بدقة، أجب مباشرة، واذكر أهم معلومة أو خطوات عملية. إذا كانت الإجابة تعتمد على بيانات حديثة غير متاحة في هذه المحادثة فقل ذلك بوضوح ولا تخترع مصدراً أو نتيجة.";
}

export function compactChatHistory(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  return messages.slice(-MAX_CHAT_HISTORY).map((message) => ({
    role: message.role,
    content: message.content.slice(-MAX_CHAT_MESSAGE_CHARS),
  }));
}


function weatherDescription(code: number) {
  if (code === 0) return "الجو صافٍ";
  if ([1, 2].includes(code)) return "الجو غائم جزئياً";
  if (code === 3) return "الجو غائم";
  if ([45, 48].includes(code)) return "ضباب خفيف";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "هناك احتمال أمطار";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "أجواء باردة مع احتمال ثلوج";
  if ([95, 96, 99].includes(code)) return "قد تحدث عواصف رعدية";
  return "حالة الطقس متغيرة";
}

const WEATHER_CITIES = [
  { names: /طرابزون|ترابزون|trabzon/i, name: "طرابزون", latitude: 41.0027, longitude: 39.7168, timezone: "Europe/Istanbul" },
  { names: /أوردو|اوردو|ordu/i, name: "أوردو", latitude: 40.9839, longitude: 37.8764, timezone: "Europe/Istanbul" },
  { names: /سامسون|samsun/i, name: "سامسون", latitude: 41.2867, longitude: 36.3300, timezone: "Europe/Istanbul" },
  { names: /ريزا|ريزه|rize/i, name: "ريزا", latitude: 41.0201, longitude: 40.5234, timezone: "Europe/Istanbul" },
  { names: /إسطنبول|اسطنبول|istanbul/i, name: "إسطنبول", latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul" },
  { names: /آيدر|ايدر|ayder/i, name: "آيدر", latitude: 40.9527, longitude: 41.0969, timezone: "Europe/Istanbul" },
  { names: /المدينة المنورة|المدينه المنوره|المدينة|المدينه|madinah|medina/i, name: "المدينة المنورة", latitude: 24.5247, longitude: 39.5692, timezone: "Asia/Riyadh" },
  { names: /القصيم|بريدة|بريده|عنيزة|عنيزه|الرس|buraydah|qassim/i, name: "القصيم (بريدة)", latitude: 26.3260, longitude: 43.9750, timezone: "Asia/Riyadh" },
  { names: /ينبع الصناعية|مدينة ينبع الصناعية|yanbu industrial/i, name: "ينبع الصناعية", latitude: 23.9994, longitude: 38.2363, timezone: "Asia/Riyadh" },
  { names: /ينبع|yanbu/i, name: "ينبع", latitude: 24.0895, longitude: 38.0618, timezone: "Asia/Riyadh" },
  { names: /حائل|حايل|hail/i, name: "حائل", latitude: 27.5114, longitude: 41.7208, timezone: "Asia/Riyadh" },
  { names: /الطائف|طايف|taif/i, name: "الطائف", latitude: 21.2703, longitude: 40.4158, timezone: "Asia/Riyadh" },
  { names: /الرياض|رياض|riyadh/i, name: "الرياض", latitude: 24.7136, longitude: 46.6753, timezone: "Asia/Riyadh" },
  { names: /مكة المكرمة|مكه المكرمه|مكة|مكه|makkah|mecca/i, name: "مكة المكرمة", latitude: 21.3891, longitude: 39.8579, timezone: "Asia/Riyadh" },
  { names: /جدة|جده|jeddah/i, name: "جدة", latitude: 21.5433, longitude: 39.1728, timezone: "Asia/Riyadh" },
] as const;

export async function getLiveWeatherAnswer(content: string): Promise<string | undefined> {
  if (!/(?:طقس|أجواء|الجو|درجة الحرارة|الحرارة|weather|temperature)/i.test(content)) return undefined;
  const city = WEATHER_CITIES.find((candidate) => candidate.names.test(content));
  if (!city) return undefined;
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m", timezone: city.timezone }).toString();
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`weather-http-${response.status}`);
    const data = await response.json() as { current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number } };
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code)) throw new Error("weather-data-invalid");
    const feels = Number.isFinite(current.apparent_temperature) ? `، والمحسوسة ${Math.round(current.apparent_temperature as number)}°` : "";
    const wind = Number.isFinite(current.wind_speed_10m) ? `، والرياح نحو ${Math.round(current.wind_speed_10m as number)} كم/س` : "";
    const readAt = current.time ? ` وقت القراءة المحلي: ${current.time}.` : "";
    return `الطقس الآن في ${city.name}: ${Math.round(current.temperature_2m as number)}° مئوية${feels}. ${weatherDescription(current.weather_code as number)}${wind}.${readAt} المصدر: Open-Meteo. هذه قراءة حالية وقد تتغير خلال اليوم.`;
  } catch (error) {
    console.warn("[ALASSAUL weather] live source unavailable", error);
    return `تعذر التحقق من الطقس الحي في ${city.name} الآن؛ لن أخمّن درجة الحرارة أو حالة الجو. جرّب بعد قليل أو افتح مصدر الطقس مباشرة: https://open-meteo.com/`;
  }
}

async function getAyderWeatherAnswer(content: string) {
  if (!/(?:طقس|أجواء|الجو|درجة الحرارة).*(?:آيدر|ايدر|ايدر)|(?:آيدر|ايدر|ايدر).*(?:طقس|أجواء|الجو|درجة الحرارة)/i.test(content)) return undefined;
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.9527&longitude=41.0969&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error("weather-request");
    const data = await response.json() as { current?: { temperature_2m?: number; apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number } };
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code)) throw new Error("weather-data");
    const feels = Number.isFinite(current.apparent_temperature) ? `، والمحسوسة ${Math.round(current.apparent_temperature as number)}°` : "";
    const wind = Number.isFinite(current.wind_speed_10m) ? `، والرياح نحو ${Math.round(current.wind_speed_10m as number)} كم/س` : "";
    return `الأجواء الآن في آيدر: ${Math.round(current.temperature_2m as number)}° مئوية${feels}. ${weatherDescription(current.weather_code as number)}${wind}. خذ معك معطفاً خفيفاً وحذاءً مناسباً للطبيعة، وتحقق من الطريق قبل الصعود للمرتفعات.`;
  } catch {
    return "لا أستطيع جلب قراءة آيدر اللحظية الآن. افتح قسم الطقس الحي في المنصة أو أعد المحاولة بعد لحظات؛ فالطقس في المرتفعات يتغير بسرعة.";
  }
}

async function getJeddahWeatherAnswer(content: string) {
  if (!/(?:جدة|جده)/i.test(content) || !/(?:طقس|الجو|الأجواء|احوال|أحوال|حرارة|درجة)/i.test(content)) return undefined;
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=21.5433&longitude=39.1728&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia%2FRiyadh", { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error("jeddah-weather");
    const data = await response.json() as { current?: { temperature_2m?: number; apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number } };
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code)) throw new Error("jeddah-weather-data");
    const feels = Number.isFinite(current.apparent_temperature) ? `، والمحسوسة ${Math.round(current.apparent_temperature as number)}°` : "";
    const wind = Number.isFinite(current.wind_speed_10m) ? `، والرياح ${Math.round(current.wind_speed_10m as number)} كم/س` : "";
    return `الطقس الآن في جدة: ${Math.round(current.temperature_2m as number)}° مئوية${feels}. ${weatherDescription(current.weather_code as number)}${wind}. تحقق من الطقس الحي قبل الخروج لأن القراءة تتغير خلال اليوم.`;
  } catch {
    return "تعذر جلب قراءة جدة اللحظية الآن. افتح صندوق الطقس الحي في المنصة أو أعد المحاولة بعد لحظات.";
  }
}

const isWorldNewsQuestion = (message: string) => /(?:أخبار العالم|اخبار العالم|(?:آخر|اخر).{0,16}(?:خبر|أخبار|اخبار)|(?:أخبار|اخبار).{0,20}(?:اليوم|العالم|إيران|ايران|أمريكا|امريكا|فلسطين|السعودية|تركيا|أوكرانيا|اوكرانيا)|الأخبار اليوم|الاخبار اليوم|خبر عاجل|عاجل|ماذا يحدث في العالم|أهم الأخبار|اهم الاخبار|latest news|world news|breaking news)/i.test(message);

function isLocalBusinessSearchQuestion(message: string) {
  const mentionsBusiness = /(?:مطعم|مطاعم|فطور|إفطار|سوبر\\s*ماركت|سوبرماركت|بقالة|بقالات|هايبر\\s*ماركت|هايبرماركت|لولو|hypermarket|supermarket|grocery|restaurant|restaurants|breakfast)/i.test(message);
  const asksForPlace = /(?:أقرب|اقرب|قريب|بالقرب|أفضل|افضل|أهم|اهم|مشهور|وين|أين|اين|أبغى|ابغى|أريد|اريد|ابي|ابحث|يقع|عنوان|موقع|nearby|nearest|near me|best|where|location|address|search)/i.test(message);
  return mentionsBusiness && asksForPlace;
}

function isSaudiLeagueQuestion(message: string) {
  return /(?:روشن|الدوري السعودي|دوري روشن|السوبر السعودي|الدوري السعودي للمحترفين|Saudi Pro League)/i.test(message);
}

function isSaudiLeagueScheduleQuestion(message: string) {
  return isSaudiLeagueQuestion(message) && /(?:جدول|مباريات|مواعيد|هذا الأسبوع|هالأسبوع|الاسبوع|الأسبوع|اليوم|الجولة|يلعب|نتيجة|fixtures|schedule|match(?:es)?|today|this week)/i.test(message);
}

/** Fetch recent indexed fixture/schedule reports when direct sports data is unavailable. */
async function getSaudiLeagueScheduleAnswer(language: "AR" | "TR" | "EN", message: string) {
  const scheduleQuestion = isSaudiLeagueScheduleQuestion(message);
  const query = language === "AR"
    ? scheduleQuestion ? "دوري روشن السعودي جدول مباريات الجولة القادمة مواعيد" : "أخبار دوري روشن السعودي اليوم"
    : scheduleQuestion ? "Saudi Pro League fixtures schedule upcoming matches" : "Saudi Pro League latest news today";
  const params = new URLSearchParams({
    q: query,
    hl: language === "AR" ? "ar" : language === "TR" ? "tr" : "en-US",
    gl: language === "AR" ? "SA" : language === "TR" ? "TR" : "US",
    ceid: language === "AR" ? "SA:ar" : language === "TR" ? "TR:tr" : "US:en",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`https://news.google.com/rss/search?${params.toString()}`, {
      headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "ALASSAUL-AI/1.0 (sports schedule lookup)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Saudi league RSS returned ${response.status}`);
    const xml = await response.text();
    const items = (xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? []).slice(0, 5).map((itemMarkup) => {
      const body = itemMarkup.replace(/^<item\b[^>]*>/i, "").replace(/<\/item>$/i, "");
      const title = decodeNewsXml(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const source = decodeNewsXml(body.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "Google News");
      const url = decodeNewsXml(body.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
      const published = decodeNewsXml(body.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
      const date = published ? new Date(published) : null;
      const dateText = date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat(language === "AR" ? "ar-SA" : language === "TR" ? "tr-TR" : "en-US", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(date)
        : "";
      return { title, source, dateText, url: /^https?:\/\//i.test(url) ? url : "" };
    }).filter((item) => item.title.length > 5 && /(?:روشن|الدوري السعودي|السعودي|الهلال|النصر|الاتحاد|الأهلي|الاهلي|الشباب|التعاون|القادسية|Saudi Pro League|Al-Hilal|Al-Nassr|Al-Ittihad|Al-Ahli)/i.test(item.title));
    if (!items.length) throw new Error("No Saudi league schedule articles returned");
    const heading = language === "AR"
      ? scheduleQuestion ? "أحدث نتائج البحث عن جدول دوري روشن السعودي" : "أحدث أخبار دوري روشن السعودي"
      : language === "TR"
        ? scheduleQuestion ? "Suudi Pro Lig fikstürü için güncel arama sonuçları" : "Suudi Pro Lig hakkında güncel haberler"
        : scheduleQuestion ? "Recent Saudi Pro League schedule search results" : "Latest Saudi Pro League news";
    const note = language === "AR"
      ? scheduleQuestion ? "هذه روابط تقارير حديثة وليست جدول مباريات موحداً مؤكداً. افتح المصدر للتحقق من موعد المباراة قبل الاعتماد عليه." : "هذه عناوين بحث إخبارية وليست نتائج مباريات مؤكدة. افتح المصدر للتحقق من التفاصيل والتوقيت."
      : language === "TR"
        ? "Bunlar güncel haber bağlantılarıdır; maç saatlerini veya sonuçları kaynaktan doğrulayın."
        : "These are recent news links, not verified live scores. Open the publisher to confirm details and match times.";
    return `${heading}\n${items.map((item, index) => `${index + 1}. ${item.title} — ${item.source}${item.dateText ? ` · ${item.dateText}` : ""}${item.url ? `\n   ${item.url}` : ""}`).join("\n")}\n\n${note}`;
  } catch (error) {
    console.warn("[ALASSAUL sports] Saudi league schedule feed unavailable", safeProviderDiagnostic(error));
    return language === "AR"
      ? "تعذر جلب نتائج حديثة عن جدول دوري روشن الآن. لن أخمّن المواعيد؛ جرّب مجدداً بعد قليل أو افتح الموقع الرسمي للدوري."
      : language === "TR"
        ? "Suudi Pro Lig fikstürü için güncel sonuçlar alınamadı. Maç saatlerini tahmin etmeyeceğim; daha sonra tekrar deneyin."
        : "Recent Saudi Pro League schedule results are unavailable. I won't guess match times; please try again later.";
  } finally {
    clearTimeout(timer);
  }
}


function getContextualFallback(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  language: "AR" | "TR" | "EN",
): string | undefined {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const recentUserText = messages.filter((message) => message.role === "user").slice(-4).map((message) => message.content).join(" ");
  const asksItinerary = /(?:رتب|رتّب|خطط|خطّط|برنامج|جدول|اقترح|itinerary|plan a trip|travel plan)/i.test(latest)
    && /(?:طرابزون|ترابزون|trabzon)/i.test(latest);
  if (asksItinerary && language === "AR") {
    return "تعذّر تشغيل المساعد الذكي مؤقتاً، لكن إليك برنامجاً مبدئياً ليوم في طرابزون:\n\n1. **الصباح:** قصر أتاتورك وحدائقه، ثم جولة قصيرة في ميدان طرابزون.\n2. **وقت الغداء:** اختر مطعماً محلياً في وسط المدينة، وتحقق من التقييمات وساعات العمل قبل التوجه إليه.\n3. **بعد الظهر:** ممشى غانيتا على البحر، أو أكواريوم طرابزون إذا كانت الرحلة عائلية.\n4. **قبل الغروب:** بو زتبه للإطلالة على المدينة والبحر.\n\nهذا اقتراح عام وليس تحققاً من الطقس أو أوقات الفتح اليوم. إذا أخبرتني بوجود أطفال أو سيارة وعدد أيام الرحلة، أرتّب لك نسخة أنسب عند عودة المساعد.";
  }

  const asksSupermarket = /(?:سوبر\s*ماركت|سوبرماركت|بقالة|بقالات|هايبر\s*ماركت|هايبرماركت|hypermarket|supermarket|grocery)/i.test(latest);
  if (asksSupermarket) {
    const area = /حي الصبح|الصبح/i.test(recentUserText) && /ينبع الصناعية|مدينة ينبع الصناعية|yanbu industrial/i.test(recentUserText) ? "حي الصبح، ينبع الصناعية"
      : /ينبع الصناعية|مدينة ينبع الصناعية|yanbu industrial/i.test(recentUserText) ? "ينبع الصناعية"
      : /ينبع|yanbu/i.test(recentUserText) ? "ينبع"
      : /طرابزون|ترابزون|trabzon/i.test(recentUserText) ? "طرابزون"
      : /يومرا|يومره|yomra/i.test(recentUserText) ? "يومرا"
      : /جدة|جده|jeddah/i.test(recentUserText) ? "جدة"
      : /المدينة المنورة|المدينه المنوره|madinah|medina/i.test(recentUserText) ? "المدينة المنورة"
      : undefined;
    const query = /لولو|lulu/i.test(latest) ? `لولو هايبر ماركت ${area ?? "ينبع"}`
      : /أقرب|اقرب|قريب|بالقرب|nearest|nearby/i.test(latest) ? `سوبر ماركت قريب ${area ?? "من موقعي الحالي"}`
      : `سوبر ماركت ${area ?? "من موقعي الحالي"}`;
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", query);
    return language === "AR"
      ? `لا أستطيع تأكيد أقرب متجر أو عنوان فرع لولو من دون نتيجة خرائط موثوقة، لذلك لن أخمّن الموقع. افتح البحث المباشر في الخرائط: [${query}](${url.toString()})${area ? "" : "\n\nاذكر المدينة والحي لأساعدك في تضييق البحث."}`
      : language === "TR"
        ? `En yakın marketin veya Lulu şubesinin adresini doğrulayamıyorum; haritada arayın: [${query}](${url.toString()})`
        : `I can't verify the nearest store or Lulu branch address, so I won't guess. [Search Google Maps: ${query}](${url.toString()})`;
  }

  const asksRestaurant = /(?:مطعم|مطاعم|فطور|إفطار|فطور|وجبة|breakfast|restaurant|restaurants|food near me)/i.test(latest);
  if (asksRestaurant) {
    const area = /ينبع الصناعية|مدينة ينبع الصناعية|yanbu industrial/i.test(recentUserText) ? "ينبع الصناعية"
      : /ينبع|yanbu/i.test(recentUserText) ? "ينبع"
      : /طرابزون|ترابزون|trabzon/i.test(recentUserText) ? "طرابزون"
      : /يومرا|يومره|yomra/i.test(recentUserText) ? "يومرا"
      : /جدة|جده|jeddah/i.test(recentUserText) ? "جدة"
      : /حائل|حايل|hail/i.test(recentUserText) ? "حائل"
      : undefined;
    const asksBreakfast = /(?:فطور|إفطار|breakfast)/i.test(latest);
    const asksBest = /(?:أهم|افضل|أفضل|مشهور|مميزة|مميزه|top|best|popular)/i.test(latest);
    const asksNearest = /(?:أقرب|اقرب|قريب|بالقرب|near(?:est)?|close to me)/i.test(latest);
    const restaurantType = asksBreakfast ? "مطاعم فطور" : asksBest ? "أفضل المطاعم" : "مطاعم";
    const query = area
      ? asksNearest ? `${restaurantType} بالقرب مني في ${area}` : `${restaurantType} في ${area}`
      : asksNearest ? `${restaurantType} بالقرب من موقعي الحالي` : `${restaurantType} قريبة مني`;
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", query);
    return language === "AR"
      ? `تعذّر إكمال البحث عن المطاعم داخل المساعد مؤقتاً، ولا أريد اختراع أسماء أو تقييمات. افتح نتائج الخرائط المباشرة هنا: [${query}](${url.toString()})${area ? "" : "\n\nلنتائج أدق، اذكر المدينة والحي."}`
      : language === "TR"
        ? `Restoran araması şu anda tamamlanamadı; isim veya puan uydurmayacağım. [Haritada ara](${url.toString()})`
        : `Restaurant search is temporarily unavailable, so I won't invent names or ratings. [Search Google Maps](${url.toString()})`;
  }
  return undefined;
}


function decodeNewsXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .trim();
}

/** Fetch a small set of current headlines from Google News RSS. If the feed is
 * unreachable, return a clear status instead of letting the model invent news. */
async function getWorldNewsAnswer(message: string, language: "AR" | "TR" | "EN") {
  if (!isWorldNewsQuestion(message)) return undefined;
  const params = new URLSearchParams({ q: message.slice(0, 160), hl: language === "AR" ? "ar" : language === "TR" ? "tr" : "en-US", gl: language === "AR" ? "SA" : language === "TR" ? "TR" : "US", ceid: language === "AR" ? "SA:ar" : language === "TR" ? "TR:tr" : "US:en" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`https://news.google.com/rss/search?${params.toString()}`, {
      headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "ALASSAUL-AI/1.0 (news reader)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`News RSS returned ${response.status}`);
    const xml = await response.text();
    const items = (xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? []).slice(0, 5).map((itemMarkup) => {
      const body = itemMarkup.replace(/^<item\b[^>]*>/i, "").replace(/<\/item>$/i, "");
      const title = decodeNewsXml(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const source = decodeNewsXml(body.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "Google News");
      const url = decodeNewsXml(body.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
      const published = decodeNewsXml(body.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
      const date = published ? new Date(published) : null;
      const dateText = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(language === "AR" ? "ar-SA" : language === "TR" ? "tr-TR" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date) : "";
      return { title, source, dateText, publishedAt: date && !Number.isNaN(date.getTime()) ? date.getTime() : 0, url: /^https?:\/\//i.test(url) ? url : "" };
    }).filter((item) => item.title.length > 5 && item.publishedAt > Date.now() - 48 * 60 * 60 * 1000);
    if (!items.length) throw new Error("News RSS returned no headlines published in the last 48 hours");
    const heading = language === "AR" ? "أبرز عناوين الأخبار الحديثة" : language === "TR" ? "Güncel öne çıkan haber başlıkları" : "Recent top headlines";
    const footer = language === "AR" ? "المصدر: Google News RSS. هذه عناوين أولية؛ افتح المصدر الإخباري للتحقق من التفاصيل والتحديثات." : language === "TR" ? "Kaynak: Google News RSS. Bunlar başlıklardır; ayrıntılar için haber kaynağını kontrol edin." : "Source: Google News RSS. These are headlines; check the publisher for details and updates.";
    return `${heading}\n${items.map((item, index) => `${index + 1}. ${item.title} — ${item.source}${item.dateText ? ` · ${item.dateText}` : ""}${item.url ? `\n   ${item.url}` : ""}`).join("\n")}\n\n${footer}`;
  } catch (error) {
    console.warn("[ALASSAUL news] live feed unavailable", error);
    return language === "AR"
      ? "تعذر جلب عناوين الأخبار الحية الآن، لذلك لن أخمّن أخبار اليوم. جرّب بعد قليل، أو أرسل رابط الخبر لألخصه وأشرح خلفيته."
      : language === "TR"
        ? "Canlı haber akışına şu anda ulaşılamıyor; güncel haberleri tahmin etmeyeceğim. Biraz sonra tekrar deneyin veya haber bağlantısını gönderin."
        : "The live news feed is unavailable right now, so I won't guess today's headlines. Try again shortly or send a news link for a summary.";
  } finally {
    clearTimeout(timer);
  }
}



export function classifyModelProviderFailure(error: unknown): "configuration" | "credentials" | "rate_limit" | "timeout" | "unavailable" | "empty_response" {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  if (/no useful answer|empty response|unhelpful model response/i.test(message)) return "empty_response";
  if (/no language-model api key|api key.{0,24}(?:missing|not configured)|missing.{0,24}(?:api key|credentials)/i.test(message)) return "configuration";
  if (/\b(?:401|403)\b|unauthorized|invalid api key|authentication failed/i.test(message)) return "credentials";
  if (/\b429\b|rate.?limit|too many requests|quota exceeded/i.test(message)) return "rate_limit";
  if (/timeout|timed out|aborterror|timeouterror|exceeded its overall time budget/i.test(message)) return "timeout";
  return "unavailable";
}

function getProviderFailureReply(language: "AR" | "TR" | "EN", error: unknown) {
  const reason = classifyModelProviderFailure(error);
  const messages = {
    AR: {
      configuration: "تعذّر إنشاء إجابة لأن مفتاح مزود الذكاء الاصطناعي غير مضبوط على الخادم. لم أخمّن جواباً؛ على مسؤول الاستضافة ضبط المفتاح سراً ثم أعد السؤال.",
      credentials: "رفض مزود الذكاء الاصطناعي بيانات الاعتماد الحالية. لم أخمّن الإجابة؛ يحتاج مسؤول الاستضافة إلى مراجعة المفتاح وصلاحياته من إعدادات الخادم.",
      rate_limit: "وصل مزود الذكاء الاصطناعي إلى حد الطلبات مؤقتاً، لذلك لم أتمكن من معالجة السؤال الآن. أعد المحاولة بعد قليل.",
      timeout: "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي قبل اكتمال الإجابة. أعد المحاولة بعد قليل أو اختصر السؤال.",
      unavailable: "تعذر الاتصال بمزود الذكاء الاصطناعي. لم تصل إجابة من النموذج؛ أعد المحاولة بعد قليل.",
      empty_response: "اتصل الخادم بمزود الذكاء الاصطناعي، لكن الرد لم يتضمن إجابة مفيدة. أعد المحاولة أو أعد صياغة السؤال.",
    },
    TR: {
      configuration: "Yapay zekâ sağlayıcısının sunucu anahtarı yapılandırılmadığı için yanıt oluşturulamadı. Tahmin yürütmedim; sunucu yöneticisi anahtarı gizli ayarlara eklemelidir.",
      credentials: "Yapay zekâ sağlayıcısı mevcut kimlik bilgilerini reddetti. Sunucu yöneticisi anahtarı ve izinlerini denetlemelidir.",
      rate_limit: "Yapay zekâ sağlayıcısının geçici istek sınırına ulaşıldı. Lütfen biraz sonra tekrar deneyin.",
      timeout: "Yapay zekâ sağlayıcısına bağlantı zaman aşımına uğradı. Biraz sonra tekrar deneyin veya soruyu kısaltın.",
      unavailable: "Yapay zekâ sağlayıcısına bağlanılamadı. Modelden yanıt alınamadı; lütfen biraz sonra tekrar deneyin.",
      empty_response: "Yapay zekâ sağlayıcısından yararlı bir yanıt alınamadı. Lütfen sorunuzu yeniden ifade edin.",
    },
    EN: {
      configuration: "I couldn't answer because the server-side AI provider key is not configured. I won't guess; the hosting administrator needs to set the key securely.",
      credentials: "The AI provider rejected the current credentials. The hosting administrator needs to review the server key and its permissions.",
      rate_limit: "The AI provider temporarily reached its request limit. Please try again shortly.",
      timeout: "The connection to the AI provider timed out before an answer was ready. Please retry shortly or shorten the question.",
      unavailable: "The AI provider could not be reached, so no model answer was received. Please retry shortly.",
      empty_response: "The AI provider responded without a useful answer. Please retry or rephrase your question.",
    },
  } as const;
  return messages[language][reason];
}

function safeProviderDiagnostic(error: unknown) {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "Unknown provider error");
  const status = raw.match(/(?:HTTP|failed:?)\s*(\d{3})/i)?.[1];
  const message = raw
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]")
    .replace(/((?:api[_ -]?key|authorization|access[_ -]?token|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 320);
  return { ...(status ? { httpStatus: Number(status) } : {}), diagnostic: message };
}

function isUnhelpfulModelText(text: string) {
  // Normalize Arabic diacritics/tatweel and Unicode compatibility forms before
  // matching common provider placeholders, so small spelling differences do
  // not leak a generic failure message to the visitor.
  const normalized = text
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return !normalized || /(?:أعد\s+إرسال|أعد\s+صياغة|لم أتمكن من (?:تجهيز|إعداد) (?:إجابة|الرد|رد)|لم أتمكن من (?:(?:ال)?إجابة|(?:ال)?اجابة|إجابتك|اجابتك|الرد(?: عليك)?)(?: الآن| الان| حاليا| في الوقت الحالي)?|لم أستطع (?:الإجابة|الاجابة|إجابتك|اجابتك)(?: الآن| الان| حاليا)?|ما قدرت أ(?:جاوب|جيب)(?:ك| على السؤال)?(?: الآن| الحين| حاليا)?|تعذر (?:إكمال الطلب|تجهيز الرد|توليد الرد|إنشاء الرد)|لا أستطيع مساعدتك الآن|لا يمكنني معالجة الطلب الآن|غير متاحة حاليا|غير مهيأة حاليا|حدث خطأ (?:أثناء|في) (?:إعداد|تجهيز) الرد|يرجى المحاولة مرة أخرى|حاول لاحقا|unable to generate (?:a )?response|unable to answer(?: your question)?(?: now| at this time)?|I (?:cannot|can't) (?:answer|respond)|something went wrong|please try again)/i.test(normalized);
}

function extractChatText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map(extractChatText).filter(Boolean).join(" ").trim();
  if (content && typeof content === "object") {
    const part = content as { text?: unknown; content?: unknown };
    if (typeof part.text === "string") return part.text.trim();
    if (part.content !== undefined) return extractChatText(part.content);
  }
  return "";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    visitorCount: publicProcedure.query(() => countRegisteredVisitors()),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  // Brain governance: expose safe diagnostics to administrators and record proposed
  // operational changes as approval-gated control requests. No endpoint here executes
  // deployment, deletion, billing, permission, or secret changes automatically.
  brain: router({
    status: adminProcedure.query(() => ({
      configured: Boolean(ENV.forgeApiUrl && ENV.forgeApiKey),
      primaryModel: ENV.primaryModel,
      backupModel: ENV.backupModel,
      permissions: {
        readDiagnostics: true,
        prepareChangeProposals: true,
        executeChanges: false,
        publishDeployment: false,
        deleteData: false,
        modifyPermissions: false,
        accessSecrets: false,
      },
      approvalRequiredFor: [
        "النشر وتغيير نسخة الموقع",
        "حذف البيانات أو تعديلها بشكل واسع",
        "تغيير الصلاحيات أو إعدادات الأمان",
        "تغيير مفاتيح الاتصال أو الفوترة",
      ],
    })),
    propose: adminProcedure
      .input(z.object({
        title: z.string().trim().min(3).max(255),
        command: z.string().trim().min(10).max(2000),
        category: z.enum(["general", "bug", "content", "partner", "security"]).default("general"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      }))
      .mutation(async ({ input }) => {
        const request = await createControlRequest({
          ...input,
          requesterType: "system",
          command: `مقترح من عقل ALASSAUL-AI — لا ينفذ تلقائياً ويتطلب موافقة مالك المنصة.\n${input.command}`,
        });
        return { success: Boolean(request), id: request?.id ?? null, status: request?.status ?? "unavailable", approvalRequired: true as const };
      }),
    // The owner may explicitly approve a proposal for a human-controlled next step,
    // or reject it. Approval only records a decision; it never executes the command.
    reviewProposal: ownerProcedure
      .input(z.object({
        id: z.number().int().positive(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().trim().min(3).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const status = input.decision === "approve" ? "reviewed" : "rejected";
        const decisionNote = `${input.decision === "approve" ? "موافقة مالك المنصة على مراجعة المقترح؛ لا تعني التنفيذ التلقائي" : "رفض المقترح من مالك المنصة"}.\nملاحظة: ${input.note}\nالمراجع: ${ctx.user.openId}\nوقت القرار: ${new Date().toISOString()}`;
        const request = await updateControlRequest(input.id, { status, decisionNote });
        return { success: Boolean(request), id: request?.id ?? input.id, status: request?.status ?? status, executed: false as const };
      }),
  }),
  control: router({
    submit: publicProcedure
      .input(z.object({ title: z.string().trim().min(3).max(255), command: z.string().trim().min(3).max(2000), category: z.enum(["general", "bug", "content", "partner", "security"]).default("general"), priority: z.enum(["low", "normal", "high", "urgent"]).default("normal") }))
      .mutation(async ({ input }) => {
        // Public callers cannot self-identify as partners or as the AI/system.
        const request = await createControlRequest({ ...input, requesterType: "visitor" });
        return { success: Boolean(request), id: request?.id ?? null, status: request?.status ?? "unavailable" };
      }),
    list: adminProcedure.query(() => listControlRequests()),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["pending", "reviewed", "in_progress", "completed", "rejected"]).optional(), assignee: z.string().max(32).optional(), decisionNote: z.string().max(2000).optional() }))
      .mutation(({ input }) => updateControlRequest(input.id, { status: input.status, assignee: input.assignee, decisionNote: input.decisionNote })),
  }),
  media: router({
    list: publicProcedure.query(() => listMediaItems()),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(255) }))
      .mutation(({ input }) => updateMediaItem(input.id, input.name)),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteMediaItem(input.id)),
    upload: adminProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(3).max(120),
        dataBase64: z.string().min(16).max(70_000_000),
      }))
      .mutation(async ({ input }) => {
        const safeName = input.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "upload";
        const bytes = Buffer.from(input.dataBase64, "base64");
        if (bytes.byteLength > 50 * 1024 * 1024) throw new Error("الملف أكبر من الحد المسموح 50MB");
        const stored = await storagePut(`media/${Date.now()}-${safeName}`, bytes, input.mimeType);
        const item = await createMediaItem({ name: input.name, url: stored.url, mimeType: input.mimeType, category: "entertainment" });
        return { success: true as const, item: item ?? { name: input.name, url: stored.url, mimeType: input.mimeType } };
      }),
  }),
  discovery: router({
    list: publicProcedure.query(() => listMediaItems("discovery")),
    upload: adminProcedure
      .input(z.object({ name: z.string().trim().min(1).max(255), mimeType: z.string().regex(/^image\//), dataBase64: z.string().min(16).max(70_000_000) }))
      .mutation(async ({ input }) => {
        const safeName = input.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "discovery-image";
        const bytes = Buffer.from(input.dataBase64, "base64");
        if (bytes.byteLength > 50 * 1024 * 1024) throw new Error("الصورة أكبر من الحد المسموح 50MB");
        const stored = await storagePut(`discovery/${Date.now()}-${safeName}`, bytes, input.mimeType);
        const item = await createMediaItem({ name: input.name, url: stored.url, mimeType: input.mimeType, category: "discovery" });
        return { success: true as const, item };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(255) }))
      .mutation(({ input }) => updateMediaItem(input.id, input.name)),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteMediaItem(input.id)),
  }),
  guestbook: router({
    list: publicProcedure.query(async () => listGuestMemories()),
    save: publicProcedure
      .input(z.object({ imageDataBase64: z.string().max(16_000_000).optional(), imageMimeType: z.string().max(120).optional(), caption: z.string().max(2000).optional() }))
      .mutation(async ({ input }) => {
        let imageUrl: string | undefined;
        if (input.imageDataBase64 && input.imageMimeType) {
          const bytes = Buffer.from(input.imageDataBase64, "base64");
          if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("الصورة أكبر من الحد المسموح 12MB");
          const stored = await storagePut(`guestbook/${Date.now()}-memory`, bytes, input.imageMimeType);
          imageUrl = stored.url;
        }
        const memory = await createGuestMemory({ imageUrl, caption: input.caption });
        if (!memory?.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "تعذر حفظ الذكرى في قاعدة البيانات. لم يتم حفظها، حاول مرة أخرى لاحقاً.",
          });
        }
        return { success: true as const, id: memory.id, imageUrl: imageUrl ?? null };
      }),
    // Visitor memories are public to read, but deletion is an administrative action.
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteGuestMemory(input.id)),
  }),
  ai: router({
    speech: publicProcedure
      .input(z.object({
        text: z.string().trim().min(1).max(5000),
        language: languageSchema,
        gender: z.enum(["male", "female"]).default("male"),
      }))
      .mutation(({ input }) => synthesizeSpeech(input.text, input.language, input.gender)),
    chat: publicProcedure
      .input(z.object({
        messages: z.array(chatMessageSchema).min(1).max(14),
        language: languageSchema,
      }))
      .mutation(async ({ input }) => {
        const latestMessage = input.messages[input.messages.length - 1];
        const latestText = latestMessage?.content ?? "";
        // A directions URL needs no Gemini or Google Maps API key.
        // Return a usable link for explicit route-opening requests.
        if (latestMessage?.role === "user" && !latestMessage.imageDataUrl
          && /(افتح|فتح|ورني|ورّني|اعرض|الخريطة|الخريطه|المسار|الطريق|اتجاهات|directions|open map|route)/i.test(latestText)) {
          const routeMatch = latestText.normalize("NFKC").match(/من\s+(.+?)\s+(?:إلى|الى|لـ)\s+(.+?)(?:[؟?!.،,]|$)/i);
          if (routeMatch) {
            const origin = routeMatch[1].trim().slice(0, 100);
            const destination = routeMatch[2].trim().slice(0, 100);
            if (origin && destination) {
              const mapUrl = new URL("https://www.google.com/maps/dir/");
              mapUrl.search = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" }).toString();
              return { text: `تفضل، هذا مسار القيادة من **${origin}** إلى **${destination}**:\n\n[افتح الطريق في خرائط Google](${mapUrl.toString()})\n\nقد تختلف المسافة ومدة الرحلة بحسب الطريق وحالة المرور.` };
            }
          }
        }

        // Keep simple identity and supported live-data questions available even
        // when the external language-model provider is temporarily unavailable.
        if (latestMessage?.role === "user" && !latestMessage.imageDataUrl) {
          if (/(?:من أنتم|من انتم|من أنت|من انت|من هو العسول|ما هو العسول|عرف بنفسك|عرّف بنفسك|who are you|what is alassaul)/i.test(latestText)) {
            return { text: "أنا روبوت ALASSAUL الرسمي، مساعد الذكاء الاصطناعي لمنصة ALASSAUL-AI. أساعدك في المعرفة العامة والأخبار والعلوم والرحلات، وأدلة وخدمات شمال تركيا، وأوضح لك عندما لا أستطيع التحقق من معلومة حديثة." };
          }

          const directWeather = await getLiveWeatherAnswer(latestText)
            ?? await getAyderWeatherAnswer(latestText)
            ?? await getJeddahWeatherAnswer(latestText);
          if (directWeather) return { text: directWeather };

          // Without verified Google Maps grounding, route local business lookups
          // to an actual map search instead of allowing the model to guess branches,
          // addresses, ratings, or opening status.
          const mapsGroundingAvailable = Boolean(process.env.GEMINI_API_KEY?.trim())
            && process.env.ALASSAUL_GOOGLE_MAPS_GROUNDING === "true";
          if (isLocalBusinessSearchQuestion(latestText) && !mapsGroundingAvailable) {
            const localSearch = getContextualFallback(input.messages, input.language);
            if (localSearch) return { text: localSearch };
          }

          if (isSaudiLeagueQuestion(latestText)) {
            return { text: await getSaudiLeagueScheduleAnswer(input.language, latestText) };
          }

          if (isWorldNewsQuestion(latestText)) {
            const directNews = await getWorldNewsAnswer(latestText, input.language);
            if (directNews) return { text: directNews };
          }
        }

        const liveContext: string[] = [];

        // Live tools enrich the model prompt; they never replace the LLM answer.
        if (latestMessage?.role === "user" && !latestMessage.imageDataUrl) {
          const weatherContext = await getLiveWeatherAnswer(latestText)
            ?? await getAyderWeatherAnswer(latestText)
            ?? await getJeddahWeatherAnswer(latestText);
          if (weatherContext) liveContext.push(`سياق من مصدر الطقس الحي:
${weatherContext}`);

          let grounded = false;
          if (isGoogleMapsQuestion(latestText) && process.env.GEMINI_API_KEY?.trim() && process.env.ALASSAUL_GOOGLE_MAPS_GROUNDING === "true") {
            try {
              const mapsContext = await getGoogleMapsGroundedAnswer(latestText, input.language);
              if (mapsContext) {
                liveContext.push(`نتيجة بحث أماكن عبر Google Maps grounding:
${mapsContext}`);
                grounded = true;
              }
            } catch (error) {
              console.warn("[ALASSAUL grounding] Google Maps source failed", safeProviderDiagnostic(error));
            }
          }

          if (isGoogleGroundingQuestion(latestText)) {
            if (process.env.GEMINI_API_KEY?.trim()) {
              try {
                const searchContext = await getGoogleGroundedAnswer(latestText, input.language);
                if (searchContext) {
                  liveContext.push(`نتيجة بحث حديثة من Google Search grounding:
${searchContext}`);
                  grounded = true;
                }
              } catch (error) {
                console.warn("[ALASSAUL grounding] Google Search source failed", safeProviderDiagnostic(error));
              }
            }
            if (!grounded && isWorldNewsQuestion(latestText)) {
              const newsContext = await getWorldNewsAnswer(latestText, input.language);
              if (newsContext) liveContext.push(`نتيجة أو حالة موجز الأخبار الحي:
${newsContext}`);
            }
            if (isSaudiLeagueScheduleQuestion(latestText)) {
              const scheduleContext = await getSaudiLeagueScheduleAnswer(input.language, latestText);
              if (scheduleContext) liveContext.push(`نتيجة بحث حديثة عن جدول دوري روشن السعودي:\n${scheduleContext}`);
            }
          } else if (isWorldNewsQuestion(latestText)) {
            const newsContext = await getWorldNewsAnswer(latestText, input.language);
            if (newsContext) liveContext.push(`نتيجة أو حالة موجز الأخبار الحي:
${newsContext}`);
          }

          if (isGoogleMapsQuestion(latestText) && !grounded) {
            liveContext.push("لم تُرجع أداة Google Maps نتيجة موثقة لهذا المكان. لا تدّعِ أنك حددت أقرب منشأة أو موقعاً؛ اطلب الحي أو الموقع وقدّم رابط بحث مناسباً عند الحاجة.");
          } else if (isGoogleGroundingQuestion(latestText) && !grounded && !liveContext.some((context) => context.startsWith("نتيجة أو حالة موجز الأخبار الحي:"))) {
            liveContext.push("لم تُرجع أدوات البحث نتيجة حية موثقة. لا تدّعِ أنك بحثت أو تحققت؛ قدّم إرشاداً عاماً فقط وصرّح بما لا يمكن تأكيده الآن.");
          }
        }

        const languageInstruction = input.language === "AR"
          ? "أجب بالعربية الفصحى المبسطة، ويمكنك فهم اللهجة الخليجية."
          : input.language === "TR"
            ? "Türkçe yanıt ver ve kısa, doğal cümleler kullan."
            : "Answer in clear, concise English.";
        const taskInstruction = latestMessage?.imageDataUrl
          ? "نمط تحليل صورة: صف العناصر الواضحة أولاً، ثم اشرح ما يمكن استنتاجه وما لا يمكن الجزم به. إذا طلب المستخدم التعرف على شيء، اذكر الاحتمالات وعلامات التمييز، ولا تخترع تفاصيل غير ظاهرة."
          : getAdaptiveTaskInstruction(latestText);
        const sourceInstruction = liveContext.length
          ? `\n\nبيانات داعمة من الأدوات الحية (ليست جواباً بديلاً عنك):\n${liveContext.join("\n\n")}\nاستخدم هذه البيانات عند صلتها بالسؤال، وانسب المصدر ووقت القراءة إن وُجدا، ولا تضف حقائق آنية غير موجودة فيها.`
          : "\n\nأجب بصفتك نموذجاً لغوياً عن السؤال الجديد مباشرة. لا تستبدل الإجابة بترحيب عام أو نص محفوظ أو رد مبني على مطابقة كلمات. في المعلومات الآنية لا تخترع؛ اذكر بوضوح إن لم يتوفر مصدر حي.";
        const history = compactChatHistory(input.messages);
        const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "auto" } }> }> = [
          { role: "system", content: `${assistantSystemPrompt}\n${languageInstruction}\n\nتوجيه المهمة الحالية:\n${taskInstruction}${sourceInstruction}` },
          ...history.map((message) => ({ role: message.role, content: message.content })),
        ];
        if (latestMessage?.imageDataUrl && llmMessages.length > 1) {
          const lastIndex = llmMessages.length - 1;
          llmMessages[lastIndex] = {
            role: "user",
            content: [
              { type: "text", text: latestText || "حلّل الصورة المرفقة واشرح ما يظهر فيها." },
              { type: "image_url", image_url: { url: latestMessage.imageDataUrl, detail: "auto" } },
            ],
          };
        }
        const llmRequest = {
          model: ENV.primaryModel,
          max_completion_tokens: 512,
          reasoning: { effort: "minimal" },
          messages: llmMessages,
        };
        const backupModel = getDistinctBackupModel(llmRequest.model, ENV.backupModel);
        let response: Awaited<ReturnType<typeof invokeLLM>>;
        let providerFailure: unknown;
        let usedBackup = false;
        const fail = (error: unknown) => ({
          text: getProviderFailureReply(input.language, error),
          errorCode: classifyModelProviderFailure(error),
        });

        try {
          response = await invokeLLM(llmRequest);
        } catch (primaryError) {
          providerFailure = primaryError;
          console.error("[ALASSAUL chat] primary model request failed", {
            model: llmRequest.model,
            errorCode: classifyModelProviderFailure(primaryError),
            ...safeProviderDiagnostic(primaryError),
          });
          if (!backupModel) {
            const contextualFallback = getContextualFallback(input.messages, input.language);
            return contextualFallback ? { text: contextualFallback } : fail(primaryError);
          }
          try {
            response = await invokeLLM({ ...llmRequest, model: backupModel, reasoning: undefined });
            usedBackup = true;
          } catch (backupError) {
            providerFailure = backupError;
            console.error("[ALASSAUL chat] backup model request failed", {
              model: backupModel,
              errorCode: classifyModelProviderFailure(backupError),
              ...safeProviderDiagnostic(backupError),
            });
            const contextualFallback = getContextualFallback(input.messages, input.language);
            return contextualFallback ? { text: contextualFallback } : fail(backupError);
          }
        }

        let text = extractChatText(response.choices?.[0]?.message?.content);
        if (isUnhelpfulModelText(text) && backupModel && !usedBackup) {
          try {
            const backupResponse = await invokeLLM({ ...llmRequest, model: backupModel, reasoning: undefined });
            text = extractChatText(backupResponse.choices?.[0]?.message?.content);
            usedBackup = true;
          } catch (backupError) {
            providerFailure = backupError;
            console.error("[ALASSAUL chat] backup model request failed after an unhelpful response", {
              model: backupModel,
              errorCode: classifyModelProviderFailure(backupError),
              ...safeProviderDiagnostic(backupError),
            });
          }
        }
        if (isUnhelpfulModelText(text)) {
          const failure = providerFailure ?? new Error("No useful answer received from language model");
          if (!providerFailure) {
            console.error("[ALASSAUL chat] model returned an empty or unhelpful response", {
              primaryModel: llmRequest.model,
              backupModel: backupModel ?? null,
            });
          }
          const contextualFallback = getContextualFallback(input.messages, input.language);
          return contextualFallback ? { text: contextualFallback } : fail(failure);
        }
        return { text };
      }),
  }),
});

export type AppRouter = typeof appRouter;
