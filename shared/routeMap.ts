export type MapPoint = { lat: number; lng: number };
export type RouteMapCamera = { center?: MapPoint; zoom: number };

type Place = { names: RegExp; position: MapPoint };

const places: Place[] = [
  { names: /همسه\s*كوي|همسي\s*كوي|hamsik[oö]y/i, position: { lat: 40.658, lng: 39.397 } },
  { names: /طرابزون|ترابزون|trabzon/i, position: { lat: 41.0053, lng: 39.7225 } },
  { names: /يومرا|يمره|يومره|yomra/i, position: { lat: 40.956, lng: 39.855 } },
  { names: /أوردو|اوردو|ordu/i, position: { lat: 40.9839, lng: 37.8764 } },
  { names: /سامسون|سامسونج|samsun/i, position: { lat: 41.2867, lng: 36.33 } },
  { names: /ريزا|ريزه|rize/i, position: { lat: 41.0201, lng: 40.5234 } },
  { names: /آيدر|ايدر|ayder/i, position: { lat: 40.9527, lng: 41.0931 } },
  { names: /أوزنجول|اوزنجول|أوزونغول|uzung[oö]l/i, position: { lat: 40.6197, lng: 40.2958 } },
  { names: /جيرسون|قيرسون|غيرسون|giresun/i, position: { lat: 40.9128, lng: 38.3895 } },
  { names: /أرسين|ارسين|arsin/i, position: { lat: 40.952, lng: 39.93 } },
  { names: /سورميني|سورمنه|s[uü]r[mn]ene/i, position: { lat: 40.906, lng: 40.116 } },
  { names: /أراكلي|اراكلي|arakl[iı]/i, position: { lat: 40.939, lng: 40.058 } },
  { names: /جدة|جده|jeddah/i, position: { lat: 21.5433, lng: 39.1728 } },
  { names: /ينبع|yanbu/i, position: { lat: 24.0895, lng: 38.0618 } },
];

function findPlace(value: string | undefined): Place | undefined {
  if (!value) return undefined;
  return places.find((place) => place.names.test(value));
}

/**
 * Approximate camera for the fallback map. Successful Google Directions requests
 * replace this with the actual route bounds. Unknown place names are not
 * geocoded here; the official directions link remains the reliable fallback.
 */
export function getRouteMapCamera(origin: string | undefined, destination: string): RouteMapCamera {
  const originPlace = findPlace(origin) ?? (origin ? undefined : findPlace("Trabzon"));
  const destinationPlace = findPlace(destination);
  const points = [originPlace?.position, destinationPlace?.position].filter((point): point is MapPoint => Boolean(point));

  if (points.length === 0) {
    return { zoom: 2 };
  }
  if (points.length === 1) {
    return { center: points[0]!, zoom: 10 };
  }

  const [first, second] = points as [MapPoint, MapPoint];
  const center = { lat: (first.lat + second.lat) / 2, lng: (first.lng + second.lng) / 2 };
  const maxDelta = Math.max(Math.abs(first.lat - second.lat), Math.abs(first.lng - second.lng));
  return { center, zoom: maxDelta > 5 ? 5 : maxDelta > 1 ? 7 : maxDelta > 0.4 ? 9 : 11 };
}
