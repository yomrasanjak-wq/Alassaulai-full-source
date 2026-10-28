/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const API_KEY = String(import.meta.env.VITE_FRONTEND_FORGE_API_KEY ?? "").trim();
const configuredForgeBaseUrl = String(import.meta.env.VITE_FRONTEND_FORGE_API_URL ?? "").trim();
const FORGE_BASE_URL = (configuredForgeBaseUrl || "https://forge.butterfly-effect.dev").replace(/\/+$/, "");
const MAPS_PROXY_PATH = "/v1/maps/proxy/maps/api/js";
let mapsScriptPromise: Promise<void> | null = null;

export function buildMapScriptUrl(apiKey: string | undefined, forgeBaseUrl: string): string {
  const key = apiKey?.trim();
  if (!key) throw new Error("Missing VITE_FRONTEND_FORGE_API_KEY");
  const base = new URL(forgeBaseUrl.trim());
  if (base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "localhost")) {
    throw new Error("Google Maps proxy URL must use HTTPS");
  }
  const scriptUrl = new URL(`${base.toString().replace(/\/+$/, "")}${MAPS_PROXY_PATH}`);
  scriptUrl.searchParams.set("key", key);
  scriptUrl.searchParams.set("v", "weekly");
  scriptUrl.searchParams.set("libraries", "marker,places,geocoding,geometry,routes");
  return scriptUrl.toString();
}

function getMapScriptUrl(): string {
  return buildMapScriptUrl(API_KEY, FORGE_BASE_URL);
}

function loadMapScript(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    let src: string;
    try {
      src = getMapScriptUrl();
    } catch (error) {
      mapsScriptPromise = null;
      reject(error);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (window.google?.maps) resolve();
      else {
        mapsScriptPromise = null;
        reject(new Error("Google Maps loaded without its API namespace"));
      }
      script.remove();
    };
    script.onerror = () => {
      mapsScriptPromise = null;
      script.remove();
      reject(new Error("Failed to load Google Maps through the configured proxy"));
    };
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  fallbackCenter?: google.maps.LatLngLiteral;
  fallbackZoom?: number;
  fallbackLabel?: string;
  fallbackCompact?: boolean;
  fallbackEnabled?: boolean;
  fallbackUnavailableMessage?: string;
  onMapReady?: (map: google.maps.Map) => void;
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
  fallbackUnavailableMessage = "لم أتمكن من تحديد إحداثيات هذه الوجهة دون خدمة خرائط Google. استخدم رابط الاتجاهات الرسمي أدناه.",
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const initialCenterRef = useRef(initialCenter);
  const initialZoomRef = useRef(initialZoom);
  initialCenterRef.current = initialCenter;
  initialZoomRef.current = initialZoom;
  const [mapError, setMapError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const notifyMapReady = usePersistFn((readyMap: google.maps.Map) => onMapReady?.(readyMap));
  const notifyMapError = usePersistFn((error: Error) => onMapError?.(error));
  const fallbackPoint = fallbackCenter ?? initialCenter;
  const fallbackSpan = fallbackZoom >= 12 ? 0.06 : fallbackZoom >= 10 ? 0.22 : 0.65;
  const fallbackBox = [
    fallbackPoint.lng - fallbackSpan,
    fallbackPoint.lat - fallbackSpan,
    fallbackPoint.lng + fallbackSpan,
    fallbackPoint.lat + fallbackSpan,
  ].join(",");
  const fallbackMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(fallbackBox)}&layer=mapnik&marker=${fallbackPoint.lat}%2C${fallbackPoint.lng}`;
  const configurationMissing = !API_KEY;

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (configurationMissing) {
        const error = new Error("Google Maps frontend API key is not configured");
        setMapError(true);
        notifyMapError(error);
        return;
      }

      try {
        setMapError(false);
        await loadMapScript();
        if (cancelled) return;
        if (!mapContainer.current || !window.google?.maps) {
          throw new Error("Map container or Google Maps API is unavailable");
        }
        const instance = new window.google.maps.Map(mapContainer.current, {
          zoom: initialZoomRef.current,
          center: initialCenterRef.current,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: true,
          mapId: "DEMO_MAP_ID",
        });
        map.current = instance;
        notifyMapReady(instance);
      } catch (cause) {
        if (cancelled) return;
        const error = cause instanceof Error ? cause : new Error("Google Maps could not be initialized");
        console.warn("Interactive map could not be initialized; showing OpenStreetMap fallback", error.message);
        setMapError(true);
        notifyMapError(error);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      const current = map.current;
      if (current && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(current);
      map.current = null;
    };
  }, [configurationMissing, notifyMapError, notifyMapReady, retryToken]);

  useEffect(() => {
    if (!map.current || mapError) return;
    map.current.setCenter(initialCenter);
    map.current.setZoom(initialZoom);
  }, [initialCenter.lat, initialCenter.lng, initialZoom, mapError]);

  // Recalculate Google Maps tiles whenever the map container changes size,
  // especially when the mobile full-screen dialog opens or closes.
  useEffect(() => {
    const container = mapContainer.current;
    if (!container || mapError || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const currentMap = map.current;
        if (!currentMap || !window.google?.maps) return;
        window.google.maps.event.trigger(currentMap, "resize");
        currentMap.setCenter(initialCenterRef.current);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mapError]);

  return (
    <div className={cn("relative h-[500px] w-full", className)}>
      <div ref={mapContainer} className={cn("h-full w-full", mapError && "hidden")} />
      {mapError && (
        <div className={cn("map-fallback map-fallback-live", fallbackCompact && "map-fallback-compact")} role="region" aria-label={`خريطة بديلة: ${fallbackLabel}`}>
          {fallbackEnabled && !fallbackCompact && (
            <div className="map-fallback-header">
              <div><span className="map-fallback-kicker">ALASSAUL · MAP</span><strong>{fallbackLabel}</strong></div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${fallbackPoint.lat}%2C${fallbackPoint.lng}`} target="_blank" rel="noreferrer">فتح في خرائط Google ↗</a>
            </div>
          )}
          {fallbackEnabled
            ? <iframe title={`خريطة بديلة لـ ${fallbackLabel}`} src={fallbackMapUrl} loading="lazy" referrerPolicy="no-referrer" />
            : <div className="map-fallback-unavailable" role="status">{fallbackUnavailableMessage}</div>}
          {fallbackEnabled && !fallbackCompact && <div className="map-fallback-footer">{configurationMissing ? "خريطة Google غير مهيأة: يلزم ضبط VITE_FRONTEND_FORGE_API_KEY في إعدادات الواجهة وإعادة البناء. هذه خريطة OpenStreetMap بديلة." : "تعذّر تحميل Google Maps؛ هذه خريطة OpenStreetMap بديلة ويمكن فتح الاتجاهات الرسمية خارج المنصة."}</div>}
          {fallbackEnabled && !fallbackCompact && !configurationMissing && (
            <button type="button" onClick={() => { mapsScriptPromise = null; setRetryToken((value) => value + 1); }}>إعادة محاولة خرائط Google</button>
          )}
        </div>
      )}
    </div>
  );
}
