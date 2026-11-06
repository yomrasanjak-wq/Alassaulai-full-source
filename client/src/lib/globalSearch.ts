export type GlobalSearchProvider = "web" | "maps";

/** Build a safe external search URL without changing or silently broadening the query. */
export function buildGlobalSearchUrl(query: string, provider: GlobalSearchProvider = "web"): string {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("Search query must not be empty.");
  }

  const encodedQuery = encodeURIComponent(normalizedQuery);
  return provider === "maps"
    ? `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`
    : `https://www.google.com/search?q=${encodedQuery}`;
}

/** Build a nearby search URL only from valid browser-provided coordinates. */
export function buildNearbySearchUrl(query: string, latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError("Latitude must be a finite value between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError("Longitude must be a finite value between -180 and 180.");
  }

  const searchTerm = query.trim() || "أماكن وخدمات";
  const nearbyQuery = `${searchTerm} near ${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return buildGlobalSearchUrl(nearbyQuery, "maps");
}
