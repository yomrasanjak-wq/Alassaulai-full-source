import React, { useState } from "react";
import { X } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  subtitle: string;
  embedUrl?: string;
  kind: "video" | "news";
  newsTitle?: string;
  newsUrl?: string;
}

const CHANNELS: Channel[] = [
  {
    id: "makkah",
    name: "مكة المكرمة",
    subtitle: "بث مباشر من الحرم",
    kind: "video",
    // Current live video published by the official Saudi Quran TV channel.
    // The previous fixed video ID had ended, which caused YouTube to show unavailable.
    embedUrl: "https://www.youtube-nocookie.com/embed/eC4LfEVxvKg?autoplay=1&mute=0&controls=1&rel=0",
  },
  {
    id: "madinah",
    name: "المدينة المنورة",
    subtitle: "بث مباشر من النبوي",
    kind: "video",
    embedUrl: "https://www.youtube-nocookie.com/embed/live_stream?channel=UCROKYPep-UuODNwyipe6JMw&autoplay=1&mute=0&controls=1&rel=0",
  },
  {
    id: "hadath",
    name: "قناة الحدث",
    subtitle: "تغطية مباشرة",
    kind: "video",
    embedUrl: "https://www.youtube-nocookie.com/embed/live_stream?channel=UCrj5BGAhtWxDfqbza9T9hqA&autoplay=1&mute=0&controls=1&rel=0",
  },
  {
    id: "breaking",
    name: "أخبار الشمال التركي",
    subtitle: "بث TRT Haber الرسمي · تركيا والبحر الأسود",
    kind: "video",
    embedUrl: "https://www.youtube-nocookie.com/embed/live_stream?channel=UCBgTP2LOFVPmq15W-RH-WXA&autoplay=1&mute=0&controls=1&rel=0",
  },
];

export default function LiveBroadcastSection() {
  const [active, setActive] = useState<Channel | null>(null);

  return (
    <section id="live" dir="rtl" className="live-broadcast-section">
      <div className="live-broadcast-inner">
        <div className="live-broadcast-heading">
          <span className="live-broadcast-kicker">مباشر الآن</span>
          <div className="live-broadcast-title-row">
            <h2>
              من نافذتك إلى المصدر الرسمي.
            </h2>
            <div className="live-broadcast-proof">
              <span />
              مصادر رسمية موثقة
            </div>
          </div>
        </div>

        <div className="live-broadcast-frame">
          {active ? (
            <div className="live-broadcast-player">
              {active.kind === "news" ? (
                <div className="live-news-fallback">
                  <span>أخبار الشمال التركي</span>
                  <h3>{active.newsTitle}</h3>
                  <a href={active.newsUrl} target="_blank" rel="noreferrer">قراءة الخبر من المصدر الرسمي ↗</a>
                </div>
              ) : (
                <iframe
                  src={active.embedUrl}
                  title={active.name}
                  className="live-broadcast-iframe"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
              <div className="live-broadcast-player-bar">
                <div className="live-broadcast-player-label">
                  <div className="live-broadcast-live-pill"><span /> LIVE</div>
                  <div>
                    <p>{active.name}</p>
                    <small>{active.subtitle}</small>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="إغلاق البث"
                  onClick={() => setActive(null)}
                  className="live-broadcast-close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="live-broadcast-grid">
              {CHANNELS.map((channel, index) => {
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setActive(channel)}
                    aria-label={`فتح بث ${channel.name}`}
                    className="live-broadcast-card"
                  >
                    <div className="live-broadcast-card-content">
                      <div className="live-broadcast-card-image">
                        {channel.id === "breaking" ? <div className="live-breaking-mark">عاجل</div> : <img src={channel.id === "makkah" ? "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=200&h=200&fit=crop" : channel.id === "madinah" ? "https://images.unsplash.com/photo-1586720871269-7d6a6a77b1df?w=200&h=200&fit=crop" : "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=200&h=200&fit=crop"} alt={channel.name} />}
                      </div>
                      <div>
                        <span>{channel.name}</span>
                        <small>{channel.subtitle}</small>
                      </div>
                    </div>
                    <span className="live-broadcast-arrow">↗</span>
                    {channel.id === "breaking" && <span className="live-broadcast-news-tag">خبر</span>}
                  </button>
                );
              })}
            </div>
          )}

          {active && (
            <div className="live-broadcast-switcher">
              {CHANNELS.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  aria-label={`التبديل إلى ${channel.name}`}
                  onClick={() => setActive(channel)}
                  className={`live-broadcast-switch ${active.id === channel.id ? "active" : ""}`}
                >
                  {channel.id === "makkah" && "مكة"}
                  {channel.id === "madinah" && "المدينة"}
                  {channel.id === "hadath" && "الحدث"}
                  {channel.id === "breaking" && "أخبار الشمال"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
