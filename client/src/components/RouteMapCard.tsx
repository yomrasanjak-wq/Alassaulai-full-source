import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, ExternalLink, MapPin, Route as RouteIcon } from "lucide-react";
import { MapView } from "@/components/Map";
import { buildDirectionsUrl } from "@shared/routeRequest";
import { getRouteMapCamera, getRouteMapPoints } from "@shared/routeMap";

type RouteMapCardProps = {
  origin?: string;
  destination: string;
  language?: "AR" | "TR" | "EN";
};

type RouteSummary = { distance: string; duration: string };
type LeafletMapAdapter = { leafletMap: any };

export function RouteMapCard({ origin, destination, language = "AR" }: RouteMapCardProps) {
  const routeLayerRef = useRef<any>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMapAdapter | null>(null);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useMemo(() => getRouteMapCamera(origin, destination), [destination, origin]);
  const routePoints = useMemo(() => getRouteMapPoints(origin, destination), [destination, origin]);
  const labels = useMemo(() => {
    if (language === "TR") return { loading: "Rota haritada hazırlanıyor…", distance: "Mesafe", duration: "Süre", open: "Google Maps'te aç", error: "Rota şu anda çizilemedi. Aşağıdaki harici yönlendirmeyi açabilirsiniz.", noCenter: "Bu rota için doğrulanmış koordinatlar yok; harici yol tarifini kullanın." };
    if (language === "EN") return { loading: "Preparing the route on the map…", distance: "Distance", duration: "Time", open: "Open in Google Maps", error: "The route could not be drawn right now. Use the external directions link below.", noCenter: "Verified coordinates are unavailable for this route; use the external directions link." };
    return { loading: "أرسم الطريق على الخريطة…", distance: "المسافة", duration: "المدة", open: "فتح الاتجاهات في Google Maps", error: "تعذر رسم الطريق الآن. يمكنك فتح الاتجاهات الخارجية أدناه.", noCenter: "لا تتوفر إحداثيات موثقة لهذه الوجهة لرسم الطريق داخل الخريطة. استخدم الاتجاهات الخارجية أدناه." };
  }, [language]);

  useEffect(() => {
    setSummary(null);
    setError(null);
    if (!mapInstance || mapLoadFailed) return;
    if (!routePoints) {
      setError(labels.noCenter);
      return;
    }

    const controller = new AbortController();
    const leafletMap = mapInstance.leafletMap;
    const [from, to] = routePoints;
    const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Route service unavailable");
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const route = data?.code === "Ok" ? data.routes?.[0] : null;
        const points = route?.geometry?.coordinates;
        if (!route || !Array.isArray(points) || points.length < 2 || !window.L) throw new Error("No route geometry");
        if (routeLayerRef.current) leafletMap.removeLayer(routeLayerRef.current);
        const latLngs = points.map(([lng, lat]: [number, number]) => [lat, lng]);
        const layer = window.L.polyline(latLngs, { color: "#0f766e", weight: 5, opacity: 0.9 });
        layer.addTo(leafletMap);
        routeLayerRef.current = layer;
        leafletMap.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 12 });
        const distanceKm = route.distance / 1000;
        const durationMinutes = Math.round(route.duration / 60);
        setSummary({
          distance: distanceKm >= 1 ? `${distanceKm.toFixed(1)} كم` : `${Math.round(route.distance)} م`,
          duration: durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)} س ${durationMinutes % 60} د` : `${durationMinutes} د`,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(labels.error);
      });

    return () => {
      controller.abort();
      if (routeLayerRef.current) {
        leafletMap.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
    };
  }, [labels.error, labels.noCenter, mapInstance, mapLoadFailed, routePoints]);

  const routeCaption = `${origin?.trim() || "طرابزون"} ← ${destination}`;

  return (
    <div className="route-map-card" dir={language === "AR" ? "rtl" : "ltr"}>
      <div className="route-map-heading">
        <span className="route-map-icon"><RouteIcon size={16} /></span>
        <div><strong>{destination}</strong><small>{routeCaption}</small></div>
      </div>
      <div className="route-map-canvas">
        <MapView
          initialCenter={camera.center ?? { lat: 0, lng: 0 }}
          initialZoom={camera.zoom}
          fallbackCenter={camera.center}
          fallbackZoom={camera.zoom}
          fallbackLabel={routeCaption}
          fallbackCompact
          fallbackEnabled={Boolean(camera.center)}
          fallbackUnavailableMessage={labels.noCenter}
          onMapReady={(readyMap) => { setMapLoadFailed(false); setMapInstance(readyMap as LeafletMapAdapter); }}
          onMapError={() => setMapLoadFailed(true)}
        />
        {!summary && !error && <div className="route-map-overlay"><MapPin size={17} /> {labels.loading}</div>}
        {error && <div className="route-map-overlay route-map-error" role="status"><MapPin size={17} /> {error}</div>}
      </div>
      {summary && <div className="route-map-summary"><span><MapPin size={14} /> <b>{labels.distance}</b> {summary.distance}</span><span><Clock3 size={14} /> <b>{labels.duration}</b> {summary.duration}</span></div>}
      <a className="route-map-open" href={buildDirectionsUrl(origin, destination)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {labels.open}</a>
    </div>
  );
}
