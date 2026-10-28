export type RouteRequest = {
  origin?: string;
  destinations: string[];
};

const ROUTE_INTENT = /(?:طريق|الطريق|مسار|اتجاه|خريطة|وصلني|توصلني|يؤدي|اوصل|route|directions|way|yol|rota|götür)/i;
const DESTINATION_PATTERN = /(?:إلى|الى|لـ|لِ|ل|نحو|جهة|إتجاه|to|towards|for|için|üzerinden)\s+([^،,.!?؟؛;]+)/ig;
const ORIGIN_PATTERN = /(?:من|ابتداءً من|بدءًا من|from|starting from|başlangıç)\s+([^،,.!?؟؛;]+?)\s+(?:إلى|الى|لـ|نحو|to|towards|için)\s+/i;

// Voice recognition can append overlapping partial transcripts. Remove only
// immediately repeated word sequences; never reorder the user's words.
function collapseRepeatedSequences(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  const normalize = (word: string) => word.toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[.,،؛:!?؟]+$/g, "");

  for (const word of words) {
    result.push(word);
    let changed = true;
    while (changed) {
      changed = false;
      for (let size = Math.min(10, Math.floor(result.length / 2)); size >= 1; size -= 1) {
        const left = result.slice(-size * 2, -size).map(normalize);
        const right = result.slice(-size).map(normalize);
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

const destinationAliases: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /(?:همسه\s*كوي|همسي\s*كوي|هامسي\s*كوي|hamsik[oö]y)/i, canonical: "Hamsiköy" },
  { pattern: /(?:طرابزون|ترابزون|trabzon)/i, canonical: "Trabzon" },
  { pattern: /(?:يومرا|يمره|يومره|yomra)/i, canonical: "Yomra" },
  { pattern: /(?:أوزنجول|اوزنجول|أوزونغول|uzung[oö]l)/i, canonical: "Uzungöl" },
  { pattern: /(?:سوميلا|سوميله|sumela|sümela)/i, canonical: "Sümela Monastery" },
  { pattern: /(?:حيدر\s*نبي|hidirnebi|hıdırnebi)/i, canonical: "Hıdırnebi" },
  { pattern: /(?:أوردو|اوردو|ordu)/i, canonical: "Ordu" },
  { pattern: /(?:سامسون|samsun)/i, canonical: "Samsun" },
  { pattern: /(?:ريزا|ريزه|rize)/i, canonical: "Rize" },
  { pattern: /(?:آيدر|ايدر|ayder)/i, canonical: "Ayder" },
  { pattern: /(?:جيرسون|قيرسون|غيرسون|giresun)/i, canonical: "Giresun" },
  { pattern: /(?:أرسين|ارسين|arsin)/i, canonical: "Arsin" },
  { pattern: /(?:سورميني|سورمنه|sürmene|surmene)/i, canonical: "Sürmene" },
  { pattern: /(?:أراكلي|اراكلي|araklı|arakli)/i, canonical: "Araklı" },
];

function canonicalizeDestination(value: string): string {
  const cleaned = value.trim().replace(/^(?:ممكن\s+)?(?:ترسلني|وصلني|ودني|خذني)\s+/i, "");
  return destinationAliases.find((alias) => alias.pattern.test(cleaned))?.canonical
    ?? cleaned.replace(/\s+(?:ممكن|لو\s*سمحت|ترسلني|وصلني|على\s+الطريق).*$/i, "").trim();
}

export function parseRouteRequest(text: string): RouteRequest | null {
  const normalized = collapseRepeatedSequences(text).replace(/\s+/g, " ").trim();
  if (!normalized || !ROUTE_INTENT.test(normalized)) return null;

  const originMatch = normalized.match(ORIGIN_PATTERN);
  const destinationMatches = Array.from(normalized.matchAll(DESTINATION_PATTERN));
  const lastDestinationMatch = destinationMatches.at(-1);
  const originRaw = originMatch?.[1]?.trim();
  const firstDestinationMatch = destinationMatches[0];
  const inferredOriginPrefix = firstDestinationMatch?.index === undefined
    ? ""
    : normalized.slice(0, firstDestinationMatch.index);
  const inferredOrigin = destinationAliases
    .map((alias) => ({ alias, match: Array.from(inferredOriginPrefix.matchAll(new RegExp(alias.pattern.source, `${alias.pattern.flags}g`))).at(-1) }))
    .filter((entry) => entry.match?.index !== undefined)
    .sort((a, b) => (b.match?.index ?? -1) - (a.match?.index ?? -1))[0]?.alias.canonical;
  const origin = originRaw
    ? destinationAliases.find((alias) => alias.pattern.test(originRaw))?.canonical ?? originRaw
    : inferredOrigin;

  const rawDestination = lastDestinationMatch?.[1]?.trim();
  if (!rawDestination) return null;

  // Prefer a recognized place name over the trailing words of a long voice
  // transcript, so the entire spoken sentence is never used as a map endpoint.
  const destination = canonicalizeDestination(rawDestination);
  const destinations = destination
    .split(/\s+(?:أو|او|or|ya da|veya)\s+(?:(?:إلى|الى|to)\s+)?/i)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);

  return destinations.length > 0 ? { origin, destinations } : null;
}

export function buildDirectionsUrl(origin: string | undefined, destination: string): string {
  const params = new URLSearchParams({ api: "1", destination });
  if (origin) params.set("origin", origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}