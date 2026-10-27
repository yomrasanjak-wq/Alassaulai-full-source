import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Check, Clock3, ExternalLink, LifeBuoy, Pause } from "lucide-react";
import { getLiveFrameMode } from "@shared/interactionFlow";
import { getLiveStatusLabel, type LiveStatus } from "@shared/liveStatus";

type LiveStatusViewProps = {
  title: string;
  subtitle: string;
  video?: string;
  sourceUrl: string;
  streamUrl?: string;
  sourceType: "youtube" | "youtube-channel" | "official-page" | "hls";
  status: LiveStatus;
  onReady: () => void;
  onUnavailable: () => void;
  onToggleStop: () => void;
};

function HlsPlayer({ src, title, onReady, onUnavailable }: { src: string; title: string; onReady: () => void; onUnavailable: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    let disposed = false;
    const markReady = () => { if (!disposed) onReady(); };
    const markUnavailable = () => { if (!disposed) onUnavailable(); };

    video.addEventListener("playing", markReady);
    video.addEventListener("error", markUnavailable);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();
      video.play().catch(markUnavailable);
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(markUnavailable);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) markUnavailable();
      });
    } else {
      markUnavailable();
    }

    return () => {
      disposed = true;
      video.pause();
      video.removeEventListener("playing", markReady);
      video.removeEventListener("error", markUnavailable);
      video.removeAttribute("src");
      video.load();
      hls?.destroy();
    };
  }, [src, onReady, onUnavailable]);

  return <video ref={videoRef} title={title} controls autoPlay muted playsInline />;
}

export function LiveStatusView({ title, subtitle, video, sourceUrl, streamUrl, sourceType, status, onReady, onUnavailable, onToggleStop }: LiveStatusViewProps) {

  useEffect(() => {
    if (sourceType !== "youtube" && sourceType !== "youtube-channel") return;
    const handlePlayerMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com" && event.origin !== "https://www.youtube.com") return;
      if (typeof event.data !== "string") return;
      try {
        const payload = JSON.parse(event.data) as { event?: string; info?: { errorCode?: number; playerState?: number } };
        if (payload.event === "onError" || [2, 5, 100, 101, 150, 153].includes(payload.info?.errorCode ?? -1)) onUnavailable();
        if (payload.event === "infoDelivery" && [1, 2].includes(payload.info?.playerState ?? -1)) onReady();
      } catch {
        // Ignore non-JSON messages from the embedded player.
      }
    };
    window.addEventListener("message", handlePlayerMessage);
    return () => window.removeEventListener("message", handlePlayerMessage);
  }, [onReady, onUnavailable, sourceType]);

  const youtubeSrc = sourceType === "youtube" && video
    ? `https://www.youtube-nocookie.com/embed/${video}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    : sourceType === "youtube-channel"
      ? `${sourceUrl}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
      : sourceUrl;
    const isOfficialPage = sourceType === "official-page";
  const statusTone = isOfficialPage ? "green" : status === "unavailable" || status === "stopped" ? "red" : "green";
  const statusLabel = isOfficialPage ? "مصدر رسمي" : getLiveStatusLabel(status);
  return (
    <section aria-label={`بث ${title}`}>
      <div className="modal-meta"><span className={`status-pill status-${statusTone}`}><span className="status-dot" />{statusLabel}</span><span>{subtitle}</span></div>
      <h2>{title}</h2>
      <div className="video-shell">
        {getLiveFrameMode(status) === "stopped" ? <div className="video-stopped"><Pause size={31} /><strong>تم إيقاف البث مؤقتاً</strong><small>يمكنك استئنافه من الزر أسفل النافذة.</small></div>
            : sourceType === "official-page" ? <div className="official-source-card official-source-compact"><div className="official-source-icon"><ExternalLink size={24} /></div><div className="official-source-copy"><strong>المشاهدة من المصدر الرسمي</strong><small>اضغط الزر لفتح القناة مباشرة.</small></div><a className="inline-source-button" href={sourceUrl} target="_blank" rel="noreferrer">فتح قناة {title} <ExternalLink size={13} /></a></div>
              : status === "unavailable" && sourceUrl ? <div className="official-source-card official-source-compact"><div className="official-source-icon"><LifeBuoy size={24} /></div><div className="official-source-copy"><strong>المشاهدة من المصدر الرسمي</strong><small>البث لا يدعم العرض داخل المنصة حاليًا.</small></div><a className="inline-source-button" href={sourceUrl} target="_blank" rel="noreferrer">فتح القناة الرسمية <ExternalLink size={13} /></a></div>
                : sourceType === "hls" && streamUrl ? <HlsPlayer src={streamUrl} title={title} onReady={onReady} onUnavailable={onUnavailable} />
                : <iframe onError={onUnavailable} src={youtubeSrc} title={title} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />}
      </div>
      {status === "loading" && sourceType !== "official-page" && <div className="in-platform-note"><Clock3 size={15} /> {"جاري التحقق من المصدر؛ لن نعرضه كبث مباشر قبل بدء التشغيل فعلياً…"}</div>}
      {sourceType === "official-page" && <div className="in-platform-note"><ExternalLink size={15} /> افتح المصدر الرسمي مباشرة لمشاهدة القناة.</div>}
      {status === "ready" && <div className="in-platform-note"><Check size={15} /> {"القناة تعمل داخل المنصة مباشرة — لا حاجة للبحث أو مغادرة الصفحة"}</div>}
      {status === "stopped" && <div className="in-platform-note"><Pause size={15} /> البث متوقف مؤقتاً داخل المنصة.</div>}
      {status === "unavailable" && sourceType !== "official-page" && <div className="in-platform-note in-platform-note-error"><LifeBuoy size={15} /> {"المشغل لم يبدأ في هذا المتصفح؛ استخدم زر المصدر الرسمي أعلاه إن أردت المحاولة."}</div>}
      <div className="video-actions">{!isOfficialPage && status !== "unavailable" && <button className="button button-primary" onClick={onToggleStop}>{status === "stopped" ? "استئناف البث" : "إيقاف مؤقت"} <Pause size={15} /></button>}</div>
    </section>
  );
}
