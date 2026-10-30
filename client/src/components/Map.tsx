import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    L?: any;
  }
}

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (typeof window !== "undefined" && window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.L) resolve(window.L);
      else { leafletPromise = null; reject(new Error("Leaflet loaded without its API")); }
    };
    if (!document.querySelector('link[data-alassaul-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.alassaulLeaflet = "true";
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-alassaul-leaflet]');
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => { leafletPromise = null; reject(new Error("Leaflet script could not load")); }, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.alassaulLeaflet = "true";
    script.onload = finish;
    script.onerror = () => { leafletPromise = null; reject(new Error("Leaflet script could not load")); };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  fallbackCenter?: { lat: number; lng: number };
  fallbackZoom?: number;
  fallbackLabel?: string;
  fallbackCompact?: boolean;
  fallbackEnabled?: boolean;
  fallbackUnavailableMessage?: string;
  onMapReady?: (map: any) => void;
  onMapError?: (error: Error) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 41.0053, lng: 39.7225 },
  initialZoom = 10,
  fallbackCenter,
  fallbackZoom = 9,
  fallbackLabel = "الخريطة المختارة",
  fallbackCompact = false,
  fallbackEnabled = true,
  fallbackUnavailableMessage = "تعذر تحميل الخريطة الآن. يمكنك فتح الموقع في خريطة خارجية.",
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const callbackRef = useRef(onMapReady);
  const errorCallbackRef = useRef(onMapError);
  callbackRef.current = onMapReady;
  errorCallbackRef.current = onMapError;
  const [mapError, setMapError] = useState(false);
  const [retry, setRetry] = useState(0);
  const center = fallbackCenter ?? initialCenter;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let leafletMap: any;
    loadLeaflet().then((L) => {
      if (cancelled || !mapContainer.current) return;
      setMapError(false);
      leafletMap = L.map(mapContainer.current, { zoomControl: true, scrollWheelZoom: true }).setView([initialCenter.lat, initialCenter.lng], initialZoom);
      const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      });
      const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      });
      satelliteLayer.addTo(leafletMap);
      L.control.layers({ "القمر الصناعي": satelliteLayer, "خريطة الشوارع": streetLayer }, undefined, { position: "topright", collapsed: false }).addTo(leafletMap);
      const adapter = {
        leafletMap,
        panTo: (point: {lat:number; lng:number}) => leafletMap.panTo([point.lat, point.lng]),
        setCenter: (point: {lat:number; lng:number}) => leafletMap.setView([point.lat, point.lng], leafletMap.getZoom()),
        setZoom: (zoom: number) => leafletMap.setZoom(zoom),
        getZoom: () => leafletMap.getZoom(),
        fitBounds: (points: Array<{lat:number; lng:number}> | any, padding: number | number[] = 48) => {
          const bounds = Array.isArray(points) ? points.map((p:any) => [p.lat, p.lng]) : points;
          leafletMap.fitBounds(bounds, { padding: [Number(padding) || 48, Number(padding) || 48], maxZoom: 12 });
        },
        invalidateSize: () => leafletMap.invalidateSize(),
      };
      mapRef.current = adapter;
      callbackRef.current?.(adapter);
      const refreshMapSize = () => {
        if (cancelled || !leafletMap || !mapContainer.current) return;
        const bounds = mapContainer.current.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) {
          leafletMap.invalidateSize({ pan: false, animate: false });
        }
      };
      const scheduleMapSizeRefresh = () => {
        requestAnimationFrame(() => requestAnimationFrame(refreshMapSize));
      };
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleMapSizeRefresh);
        resizeObserver.observe(mapContainer.current);
        if (mapContainer.current.parentElement) resizeObserver.observe(mapContainer.current.parentElement);
      }
      window.addEventListener("resize", scheduleMapSizeRefresh, { passive: true });
      window.addEventListener("orientationchange", scheduleMapSizeRefresh, { passive: true });
      document.addEventListener("visibilitychange", scheduleMapSizeRefresh);
      // Leaflet can initialize while the responsive/portal container is still settling.
      // Re-measure after the first paint and after mobile layout/full-screen transitions.
      const refreshTimers = [0, 120, 350, 800].map((delay) =>
        window.setTimeout(scheduleMapSizeRefresh, delay),
      );
      scheduleMapSizeRefresh();
    }).catch((cause) => {
      if (cancelled) return;
      const error = cause instanceof Error ? cause : new Error("تعذر تهيئة الخريطة");
      setMapError(true);
      errorCallbackRef.current?.(error);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMapSizeRefresh);
      window.removeEventListener("orientationchange", scheduleMapSizeRefresh);
      document.removeEventListener("visibilitychange", scheduleMapSizeRefresh);
      refreshTimers.forEach((timer) => window.clearTimeout(timer));
      if (leafletMap) leafletMap.remove();
      mapRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.leafletMap.setView([initialCenter.lat, initialCenter.lng], initialZoom);
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  return (
    <div className={cn("relative h-[500px] w-full overflow-hidden rounded-xl", className)}>
      <div ref={mapContainer} className={cn("h-full min-h-[320px] w-full bg-slate-100", mapError && "hidden")} />
      {mapError && (
        <div className="flex min-h-[320px] h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-700" role="region" aria-label={`خريطة بديلة: ${fallbackLabel}`}>
          <strong>تعذر تحميل الخريطة التفاعلية</strong>
          <p className="text-sm">{fallbackUnavailableMessage}</p>
          {fallbackEnabled && <a className="rounded-lg bg-emerald-800 px-4 py-2 text-white" href={`https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=${fallbackZoom}/${center.lat}/${center.lng}`} target="_blank" rel="noreferrer">فتح الخريطة</a>}
          <button type="button" className="rounded-lg border px-4 py-2" onClick={() => { leafletPromise = null; setRetry((v) => v + 1); }}>إعادة المحاولة</button>
        </div>
      )}
    </div>
  );
}
