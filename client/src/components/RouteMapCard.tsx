import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, ExternalLink, MapPin, Route as RouteIcon } from "lucide-react";
import { MapView } from "@/components/Map";
import { buildDirectionsUrl } from "@shared/routeRequest";
import { getRouteMapCamera } from "@shared/routeMap";

type RouteMapCardProps = {
  origin?: string;
  destination: string;
  language?: "AR" | "TR" | "EN";
};

type RouteSummary = { distance: string; duration: string };

export function RouteMapCard({ origin, destination, language = "AR" }: RouteMapCardProps) {
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useMemo(() => getRouteMapCamera(origin, destination), [destination, origin]);
  const labels = useMemo(() => {
    if (language === "TR") return { loading: "Rota haritada hazırlanıyor…", distance: "Mesafe", duration: "Süre", open: "Google Maps'te aç", error: "Rota çizilemedi. Resmî Google Maps yönlendirmesini açabilirsiniz.", noCenter: "Bu rota için yerel koordinatlar belirlenemedi; resmî yol tarifini açın." };
    if (language === "EN") return { loading: "Preparing the route on the map…", distance: "Distance", duration: "Time", open: "Open in Google Maps", error: "The route could not be drawn. You can open the official Google Maps directions.", noCenter: "Local coordinates are unavailable for this route; use the official directions link." };
    return { loading: "أرسم الطريق على الخريطة…", distance: "المسافة", duration: "المدة", open: "فتح الاتجاهات في Google Maps", error: "تعذر رسم الطريق على الخريطة. يمكنك فتح الاتجاهات الرسمية في Google Maps.", noCenter: "لم أتمكن من تحديد إحداثيات هذه الوجهة دون خدمة خرائط Google. استخدم رابط الاتجاهات الرسمي أدناه." };
  }, [language]);

  useEffect(() => {
    setSummary(null);
    setError(mapLoadFailed ? labels.error : null);
    if (!mapInstance || mapLoadFailed || !window.google?.maps) return;

    let cancelled = false;
    const renderer = new google.maps.DirectionsRenderer({ suppressMarkers: false, preserveViewport: false });
    rendererRef.current = renderer;
    renderer.setMap(mapInstance);
    const service = new google.maps.DirectionsService();
    const clearRenderer = () => {
      renderer.setMap(null);
      google.maps.event.clearInstanceListeners(renderer);
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
    service.route(
      {
        origin: origin?.trim() || "Trabzon, Türkiye",
        destination: destination.trim(),
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (cancelled) return;
        if (status !== "OK" || !result) {
          clearRenderer();
          setError(labels.error);
          return;
        }
        renderer.setDirections(result);
        const leg = result.routes[0]?.legs[0];
        setSummary(leg?.distance && leg?.duration ? { distance: leg.distance.text, duration: leg.duration.text } : null);
        if (!leg?.distance || !leg?.duration) setError(labels.error);
      },
    );

    return () => {
      cancelled = true;
      clearRenderer();
    };
  }, [destination, labels.error, mapInstance, mapLoadFailed, origin]);

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
          onMapReady={(readyMap) => { setMapLoadFailed(false); setMapInstance(readyMap); }}
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
