export type WikimediaNearbyAttraction = {
  name: string;
  lat: number;
  lon: number;
  url: string;
  language: string;
};

const TOURISM_CATEGORY = /attraction|museum|park|garden|waterfall|lake|cave|monastery|mosque|church|castle|historic|touris|beach|viewpoint|archaeological|mansion|palace|mountain|plateau|heritage|monument|fortress|cathedral|basilica/i;

/**
 * Fallback to Wikipedia's public geosearch API when shared Overpass servers
 * are unreachable. Results are accepted only when their article categories
 * identify a cultural, historic, or visitor attraction.
 */
export async function getWikimediaNearbyAttractions(
  latitude: number,
  longitude: number,
  preferredLanguage: "AR" | "TR" | "EN",
): Promise<WikimediaNearbyAttraction[]> {
  const preferred = preferredLanguage === "AR" ? "ar" : preferredLanguage === "TR" ? "tr" : "en";
  const languages = [...new Set([preferred, "en", "tr", "ar"])];
  const attempts = await Promise.all(languages.map(async (language) => {
    const params = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggscoord: latitude + "|" + longitude,
      ggsradius: "18000",
      ggslimit: "50",
      prop: "coordinates|categories",
      cllimit: "30",
      format: "json",
      formatversion: "2",
    });
    try {
      const response = await fetch("https://" + language + ".wikipedia.org/w/api.php?" + params.toString(), {
        headers: { accept: "application/json", "user-agent": "ALASSAUL-AI/1.0 (https://alassaul.com; attraction lookup)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error("Wikipedia API HTTP " + response.status);
      const data = await response.json() as {
        query?: { pages?: Array<{
          title?: string;
          coordinates?: Array<{ lat?: number; lon?: number }>;
          categories?: Array<{ title?: string }>;
        }> };
      };
      return (data.query?.pages ?? []).flatMap((page) => {
        const coordinate = page.coordinates?.[0];
        const categories = page.categories ?? [];
        const isAttraction = categories.some((category) => TOURISM_CATEGORY.test(category.title ?? ""));
        const lat = Number(coordinate?.lat);
        const lon = Number(coordinate?.lon);
        if (!page.title || !isAttraction || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
        return [{
          name: page.title,
          lat,
          lon,
          url: "https://" + language + ".wikipedia.org/wiki/" + encodeURIComponent(page.title.replace(/ /g, "_")),
          language,
        }];
      });
    } catch {
      return [];
    }
  }));
  const unique = new Map<string, WikimediaNearbyAttraction>();
  for (const result of attempts) {
    for (const place of result) {
      const key = place.name.normalize("NFKC").toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, place);
    }
  }
  return [...unique.values()].slice(0, 8);
}
