export type RouteRequest = {
  origin?: string;
  destinations: string[];
};

const ROUTE_INTENT = /(?:طريق|الطريق|مسار|اتجاه|خريطة|وصلني|توصلني|يؤدي|اوصل|route|directions|way|yol|rota|götür)/i;
const DESTINATION_PATTERN = /(?:إلى|الى|لـ|لِ|ل|نحو|جهة|إتجاه|to|towards|for|için|üzerinden)\s+([^،,.!?؟؛;]+)/i;
const ORIGIN_PATTERN = /(?:من|ابتداءً من|بدءًا من|from|starting from|başlangıç)\s+([^،,.!?؟؛;]+?)\s+(?:إلى|الى|لـ|نحو|to|towards|için)\s+/i;

export function parseRouteRequest(text: string): RouteRequest | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized || !ROUTE_INTENT.test(normalized)) return null;

  const originMatch = normalized.match(ORIGIN_PATTERN);
  const destinationMatch = normalized.match(DESTINATION_PATTERN);
  const origin = originMatch?.[1]?.trim();
  const rawDestination = destinationMatch?.[1]?.trim();
  if (!rawDestination) return null;

  const destinations = rawDestination
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
