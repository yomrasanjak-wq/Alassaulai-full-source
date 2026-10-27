import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRightLeft, CalendarDays, ChevronLeft, ChevronRight, CloudSun, Clock3, Languages, Mic, Navigation, RefreshCw, Ticket, Volume2, VolumeX, WalletCards, X } from "lucide-react";

type Language = "AR" | "TR" | "EN";
type LivePulseProps = { language: Language; onPlanRoute: () => void };
type WeatherState = { temperature: number; weatherCode: number; updatedAt: Date };
type RateState = { tryPerSar: number; updatedAt: Date };
type CurrencyCode = "SAR" | "TRY" | "USD" | "EUR";

const currencyNames: Record<Language, Record<CurrencyCode, string>> = {
  AR: { SAR: "ريال سعودي", TRY: "ليرة تركية", USD: "دولار أمريكي", EUR: "يورو" },
  TR: { SAR: "Suudi riyali", TRY: "Türk lirası", USD: "ABD doları", EUR: "Euro" },
  EN: { SAR: "Saudi riyal", TRY: "Turkish lira", USD: "US dollar", EUR: "Euro" },
};
const weatherLabels: Record<Language, Record<string, string>> = {
  AR: { clear: "صحو", partly: "غائم جزئياً", cloudy: "غائم", rain: "ممطر", snow: "ثلوج", storm: "عاصفة", unknown: "حالة الطقس" },
  TR: { clear: "Açık", partly: "Parçalı bulutlu", cloudy: "Bulutlu", rain: "Yağmurlu", snow: "Karlı", storm: "Fırtınalı", unknown: "Hava durumu" },
  EN: { clear: "Clear", partly: "Partly cloudy", cloudy: "Cloudy", rain: "Rainy", snow: "Snow", storm: "Storm", unknown: "Weather" },
};
const ui: Record<Language, Record<string, string>> = {
  AR: { updated: "تحديث حي", localTime: "الوقت العالمي", date: "التاريخ اليوم", weather: "طقس طرابزون الآن", currency: "سعر الصرف", translate: "الترجمة الفورية", plan: "خطط مسارك", loading: "جارٍ التحديث…", unavailable: "المصدر غير متاح حالياً", sar: "ريال سعودي", try: "ليرة تركية", converter: "محوّل العملات", convert: "تحديث الأسعار", amount: "المبلغ", swap: "تبديل العملات", close: "إغلاق" },
  TR: { updated: "Canlı güncelleme", localTime: "Dünya saati", date: "Bugünün tarihi", weather: "Trabzon hava durumu", currency: "Döviz kuru", translate: "Anında çeviri", plan: "Rotanı planla", loading: "Güncelleniyor…", unavailable: "Kaynak şu an kullanılamıyor", sar: "Suudi riyali", try: "Türk lirası", converter: "Döviz çevirici", convert: "Kurları güncelle", amount: "Tutar", swap: "Para birimlerini değiştir", close: "Kapat" },
  EN: { updated: "Live updates", localTime: "World clock", date: "Today's date", weather: "Trabzon weather now", currency: "Exchange rate", translate: "Live translation", plan: "Plan your route", loading: "Updating…", unavailable: "Source is currently unavailable", sar: "Saudi riyal", try: "Turkish lira", converter: "Currency converter", convert: "Refresh rates", amount: "Amount", swap: "Swap currencies", close: "Close" },
};

function weatherText(code: number, language: Language) {
  const labels = weatherLabels[language];
  if (code === 0) return labels.clear;
  if ([1, 2].includes(code)) return labels.partly;
  if (code === 3) return labels.cloudy;
  if ([45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return labels.rain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return labels.snow;
  if ([95, 96, 99].includes(code)) return labels.storm;
  return labels.unknown;
}
function formatDate(date: Date, language: Language) {
  const locale = language === "AR" ? "ar-SA" : language === "TR" ? "tr-TR" : "en-GB";
  return {
    gregorian: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date),
    hijri: new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(date),
  };
}

export function LivePulse({ language, onPlanRoute }: LivePulseProps) {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [rate, setRate] = useState<RateState | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingRate, setLoadingRate] = useState(true);
  const [converterOpen, setConverterOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);
  const [translationSource, setTranslationSource] = useState<Language>(language);
  const [translationTarget, setTranslationTarget] = useState<Language>(language === "AR" ? "TR" : "AR");
  const [translationInput, setTranslationInput] = useState("");
  const [translationResult, setTranslationResult] = useState("");
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationListening, setTranslationListening] = useState(false);
  const [translationSpeaking, setTranslationSpeaking] = useState(false);
  const translationRecognitionRef = useRef<{ stop?: () => void } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [amount, setAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>("SAR");
  const [toCurrency, setToCurrency] = useState<CurrencyCode>("TRY");
  const [fxRates, setFxRates] = useState<Record<CurrencyCode, number> | null>(null);
  const [loadingFx, setLoadingFx] = useState(false);
  const labels = ui[language];
  const date = useMemo(() => formatDate(now, language), [now, language]);
  const locale = language === "AR" ? "ar-SA" : language === "TR" ? "tr-TR" : "en-GB";
  const worldTimes = useMemo(() => [
    { label: language === "AR" ? "إسطنبول" : language === "TR" ? "İstanbul" : "Istanbul", zone: "Europe/Istanbul" },
    { label: language === "AR" ? "مكة" : language === "TR" ? "Mekke" : "Makkah", zone: "Asia/Riyadh" },
    { label: "UTC", zone: "UTC" },
  ].map((item) => ({ ...item, time: now.toLocaleTimeString(locale, { timeZone: item.zone, hour: "2-digit", minute: "2-digit" }) })), [language, now]);
  const convertedAmount = useMemo(() => {
    if (!fxRates) return null;
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount)) return null;
    return numericAmount * (fxRates[toCurrency] / fxRates[fromCurrency]);
  }, [amount, fromCurrency, toCurrency, fxRates]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadWeather = async () => {
      setLoadingWeather(true);
      try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=41.0015&longitude=39.7178&current=temperature_2m,weather_code&timezone=auto", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("weather");
        const data = await response.json();
        if (!cancelled) setWeather({ temperature: Number(data.current.temperature_2m), weatherCode: Number(data.current.weather_code), updatedAt: new Date() });
      } catch { if (!cancelled) setWeather(null); } finally { if (!cancelled) setLoadingWeather(false); }
    };
    loadWeather();
    const refresh = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadRate = async () => {
      setLoadingRate(true);
      try {
        const response = await fetch("https://api.frankfurter.app/latest?from=SAR&to=TRY", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("rate");
        const data = await response.json();
        const tryPerSar = Number(data.rates?.TRY);
        if (!Number.isFinite(tryPerSar)) throw new Error("rate");
        if (!cancelled) setRate({ tryPerSar, updatedAt: new Date() });
      } catch { if (!cancelled) setRate(null); } finally { if (!cancelled) setLoadingRate(false); }
    };
    loadRate();
    const refresh = window.setInterval(loadRate, 15 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  const loadFxRates = async () => {
    setLoadingFx(true);
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("fx");
      const data = await response.json();
      const rates = data.rates ?? {};
      const next = { USD: 1, SAR: Number(rates.SAR), TRY: Number(rates.TRY), EUR: Number(rates.EUR) };
      if (Object.values(next).every((value) => Number.isFinite(value) && value > 0)) setFxRates(next);
      else throw new Error("fx");
    } catch { setFxRates(null); } finally { setLoadingFx(false); }
  };
  const openConverter = () => { setConverterOpen(true); if (!fxRates) void loadFxRates(); };
  const openTranslation = () => { setTranslationSource(language); setTranslationTarget(language === "AR" ? "TR" : "AR"); setTranslationResult(""); setTranslationOpen(true); };
  const translateValue = (value: string, target: Language) => {
    const text = value.trim();
    if (!text) { setTranslationResult(language === "AR" ? "اكتب النص أولاً ثم اضغط «ترجم الآن»." : "Please enter text first."); return; }
    const normalizeArabic = (value: string) => value.replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
    const normalized = normalizeArabic(text).replace(/[،؛؟!?.,]/g, "").replace(/\s+/g, "").toLowerCase();
    const normalizedWithSpaces = normalizeArabic(text).replace(/[،؛؟!?.,]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const known: Record<string, Partial<Record<Language, string>>> = {
      "السلامعليكم": { AR: "السلام عليكم", TR: "Selamün aleyküm", EN: "Peace be upon you" },
      "السلامعليكمورحمةاللهوبركاته": { AR: "السلام عليكم ورحمة الله وبركاته", TR: "Selamün aleyküm ve rahmetullahi ve berekatühü", EN: "Peace be upon you and God's mercy and blessings" },
      "هلتستطيعمساعدتي": { AR: "هل تستطيع مساعدتي؟", TR: "Bana yardım edebilir misin?", EN: "Can you help me?" },
      "هل تستطيع مساعدتي": { AR: "هل تستطيع مساعدتي؟", TR: "Bana yardım edebilir misin?", EN: "Can you help me?" },
      "شكرا": { AR: "شكراً", TR: "Teşekkürler", EN: "Thank you" },
      "شكراً": { AR: "شكراً", TR: "Teşekkürler", EN: "Thank you" },
      "مرحبا": { AR: "مرحباً", TR: "Merhaba", EN: "Hello" },
      "door": { AR: "باب", TR: "kapı", EN: "door" },
      "باب": { AR: "باب", TR: "kapı", EN: "door" },
      "انااريدالذهاباليالمدرسه": { AR: "أنا أريد الذهاب إلى المدرسة", TR: "Okula gitmek istiyorum", EN: "I want to go to school" },
      "اريدالذهاباليالمدرسه": { AR: "أريد الذهاب إلى المدرسة", TR: "Okula gitmek istiyorum", EN: "I want to go to school" },
      "انااريدالذهاباليالمدرسة": { AR: "أنا أريد الذهاب إلى المدرسة", TR: "Okula gitmek istiyorum", EN: "I want to go to school" },
      "çokgüzel": { AR: "جميل جداً", TR: "çok güzel", EN: "very beautiful" },
      "cokguzel": { AR: "جميل جداً", TR: "çok güzel", EN: "very beautiful" },
      "merhaba": { AR: "مرحباً", TR: "Merhaba", EN: "Hello" },
      "teşekkürler": { AR: "شكراً", TR: "Teşekkürler", EN: "Thank you" },
      "tesekkurler": { AR: "شكراً", TR: "Teşekkürler", EN: "Thank you" },
      "lütfen": { AR: "من فضلك", TR: "Lütfen", EN: "Please" },
      "lutfen": { AR: "من فضلك", TR: "Lütfen", EN: "Please" },
      "günaydın": { AR: "صباح الخير", TR: "Günaydın", EN: "Good morning" },
      "gunaydin": { AR: "صباح الخير", TR: "Günaydın", EN: "Good morning" },
      "صباحالخير": { AR: "صباح الخير", TR: "Günaydın", EN: "Good morning" },
      "صباح الخير": { AR: "صباح الخير", TR: "Günaydın", EN: "Good morning" },
      "iyi geceler": { AR: "تصبح على خير", TR: "İyi geceler", EN: "Good night" },
      "iyigeceler": { AR: "تصبح على خير", TR: "İyi geceler", EN: "Good night" },
      "su": { AR: "ماء", TR: "Su", EN: "Water" },
      "yardım": { AR: "مساعدة", TR: "Yardım", EN: "Help" },
      "yardim": { AR: "مساعدة", TR: "Yardım", EN: "Help" },
    };
    const words: Record<string, Partial<Record<Language, string>>> = {
      hello: { AR: "مرحباً", TR: "Merhaba", EN: "hello" },
      thankyou: { AR: "شكراً", TR: "Teşekkürler", EN: "thank you" },
      hospital: { AR: "مستشفى", TR: "hastane", EN: "hospital" },
      hotel: { AR: "فندق", TR: "otel", EN: "hotel" },
      trabzon: { AR: "طرابزون", TR: "Trabzon", EN: "Trabzon" },
      turkey: { AR: "تركيا", TR: "Türkiye", EN: "Turkey" },
      باب: { AR: "باب", TR: "kapı", EN: "door" },
      مستشفى: { AR: "مستشفى", TR: "hastane", EN: "hospital" },
      فندق: { AR: "فندق", TR: "otel", EN: "hotel" },
    };
    const translated = known[normalized]?.[target] ?? known[normalizedWithSpaces]?.[target] ?? words[normalized]?.[target] ?? words[normalizedWithSpaces]?.[target];
    if (translated) { setTranslationResult(`${translated}`); return; }
    setTranslationLoading(true);
    setTranslationResult(language === "AR" ? "جارٍ جلب الترجمة…" : "Translating…");
    try {
      const source = translationSource.toLowerCase();
      const targetCode = target.toLowerCase();
      const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
      fetch(endpoint, { headers: { Accept: "application/json" } })
        .then(async (response) => {
          if (!response.ok) throw new Error("google-translate");
          const data = await response.json();
          const result = Array.isArray(data?.[0]) ? data[0].map((part: unknown[]) => String(part?.[0] ?? "")).join("").trim() : "";
          if (!result) throw new Error("empty-translation");
          setTranslationResult(result);
        })
        .catch(() => setTranslationResult(language === "AR" ? "تعذر جلب الترجمة الآن. افتح Google Translate للترجمة الكاملة." : "Translation is unavailable. Open Google Translate for the full result."))
        .finally(() => setTranslationLoading(false));
    } catch {
      setTranslationLoading(false);
      setTranslationResult(language === "AR" ? "تعذر جلب الترجمة الآن. افتح Google Translate للترجمة الكاملة." : "Translation is unavailable. Open Google Translate for the full result.");
    }
  };
  const translateText = () => void translateValue(translationInput, translationTarget);
  const googleTranslateUrl = `https://translate.google.com/?sl=${translationSource.toLowerCase()}&tl=${translationTarget.toLowerCase()}&text=${encodeURIComponent(translationInput)}&op=translate`;
  useEffect(() => {
    if (!translationOpen || !translationInput.trim()) return;
    const timer = window.setTimeout(() => void translateValue(translationInput, translationTarget), 220);
    return () => window.clearTimeout(timer);
  }, [translationInput, translationTarget, translationOpen]);
  useEffect(() => {
    if (!translationOpen) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [translationOpen]);
  const startTranslationVoice = () => {
    if (translationListening) { translationRecognitionRef.current?.stop?.(); setTranslationListening(false); return; }
    const speechWindow = window as Window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { setTranslationResult(language === "AR" ? "التحدث الصوتي يحتاج Chrome أو Edge. اكتب النص وسيترجم فورياً." : "Voice input needs Chrome or Edge."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = translationSource === "AR" ? "ar-SA" : translationSource === "TR" ? "tr-TR" : "en-US";
    recognition.continuous = false; recognition.interimResults = true;
    recognition.onstart = () => setTranslationListening(true);
    recognition.onend = () => setTranslationListening(false);
    recognition.onerror = () => { setTranslationListening(false); setTranslationResult(language === "AR" ? "تعذر التقاط الصوت. جرّب مرة أخرى أو اكتب النص." : "Voice input failed. Try again or type the text."); };
    recognition.onresult = (event: any) => { const transcript = Array.from(event.results as ArrayLike<any>).map((result: any) => result[0]?.transcript ?? "").join(" "); setTranslationInput(transcript); };
    translationRecognitionRef.current = recognition; recognition.start();
  };
  const speakTranslation = () => {
    if (!translationResult || !("speechSynthesis" in window)) return;
    if (translationSpeaking) { window.speechSynthesis.cancel(); setTranslationSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(translationResult);
    utterance.lang = translationTarget === "AR" ? "ar-SA" : translationTarget === "TR" ? "tr-TR" : "en-US";
    utterance.rate = 0.92; utterance.onstart = () => setTranslationSpeaking(true); utterance.onend = () => setTranslationSpeaking(false); utterance.onerror = () => setTranslationSpeaking(false);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  };
  const swapCurrencies = () => { setFromCurrency(toCurrency); setToCurrency(fromCurrency); };
  const calendarLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(calendarMonth);
  const calendarWeekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 7 + index)));
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  // The RTL grid already renders Sunday on the right and Saturday on the left.
  // Do not add an Arabic offset here; it shifts every date one column forward.
  const firstDay = monthStart.getDay();
  const calendarCells = [...Array(firstDay).fill(null), ...Array.from({ length: monthDays }, (_, index) => index + 1)];
  const moveCalendarMonth = (offset: number) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return (
    <section className="pulse-section" aria-label={labels.updated}>
      <div className="container live-pulse-cards">
        <article className="live-info-card live-calendar-card">
          <div className="live-card-heading"><span className="live-card-icon calendar-icon"><CalendarDays size={20} /></span><div><small>{labels.date}</small><strong>{date.hijri}</strong></div></div>
          <div className="calendar-toolbar"><button onClick={() => moveCalendarMonth(-1)} aria-label="الشهر السابق"><ChevronRight size={15} /></button><strong>{calendarLabel}</strong><button onClick={() => moveCalendarMonth(1)} aria-label="الشهر التالي"><ChevronLeft size={15} /></button></div>
          <div className="calendar-weekdays">{calendarWeekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="calendar-days">{calendarCells.map((day, index) => <span key={`${day ?? "empty"}-${index}`} className={day === now.getDate() && calendarMonth.getMonth() === now.getMonth() && calendarMonth.getFullYear() === now.getFullYear() ? "calendar-day-today" : ""}>{day ?? ""}</span>)}</div>
        </article>
        <article className="live-info-card live-time-card"><div className="live-card-heading"><span className="live-card-icon time-icon"><Clock3 size={20} /></span><div><small>{labels.localTime}</small><strong>{worldTimes[0].time}</strong></div></div><div className="world-time-list" aria-label={labels.localTime}>{worldTimes.map((item) => <span key={item.zone}><b>{item.label}</b><em>{item.time}</em></span>)}</div><p>{date.gregorian}</p><small className="live-card-hint">{labels.updated}</small></article>
        <article className="live-info-card live-weather-card"><div className="live-card-heading"><span className="live-card-icon weather-icon"><CloudSun size={20} /></span><div><small>{labels.weather}</small><strong>{loadingWeather ? labels.loading : weather ? `${weather.temperature.toFixed(0)}° · ${weatherText(weather.weatherCode, language)}` : labels.unavailable}</strong></div></div><div className="weather-visibility-line"><span>TRABZON</span><b>{weather ? `${weather.temperature.toFixed(0)}°` : "—"}</b></div><p>{weather ? "آخر قراءة للزائر" : labels.loading}</p><small className="live-card-hint">{weather?.updatedAt ? new Date(weather.updatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}</small></article>
        <button className="live-info-card live-currency-card" onClick={openConverter} aria-label={labels.converter}><div className="live-card-heading"><span className="live-card-icon currency-icon"><ArrowRightLeft size={22} strokeWidth={2.2} /></span><div><small>{labels.currency}</small><strong>{loadingRate ? labels.loading : rate ? `1 ${labels.sar} = ${rate.tryPerSar.toFixed(3)} ${labels.try}` : labels.unavailable}</strong></div><Ticket size={14} /></div><p>{labels.converter}</p><small className="live-card-hint">{labels.convert}</small></button>
        <button className="live-info-card live-translate-card" onClick={openTranslation} aria-label={labels.translate}><div className="live-card-heading"><span className="live-card-icon translate-icon"><Languages size={22} strokeWidth={2.2} /></span><div><small>{labels.translate}</small><strong>AR · TR · EN</strong></div></div><div className="translation-pills"><span>العربية</span><span>Türkçe</span><span>English</span></div><p>{language === "AR" ? "العربية مفعلة" : language === "TR" ? "Türkçe etkin" : "English active"}</p><small className="live-card-hint">اضغط للكتابة والترجمة</small></button>
        <div className="live-pulse-route"><button onClick={onPlanRoute}><Navigation size={17} /> {labels.plan} <ArrowLeft size={14} /></button></div>
      </div>
      {converterOpen && <div className="container currency-converter" role="dialog" aria-label={labels.converter}>
        <div className="currency-converter-head"><div><span className="section-eyebrow">Currency Plus</span><h3>{labels.converter}</h3></div><button onClick={() => setConverterOpen(false)} aria-label={labels.close}><X size={18} /></button></div>
        <div className="currency-fields">
          <label><span>{labels.amount}</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={labels.amount} /></label>
          <label><span>{currencyNames[language][fromCurrency]}</span><select value={fromCurrency} onChange={(event) => setFromCurrency(event.target.value as CurrencyCode)} aria-label={currencyNames[language][fromCurrency]}>{(Object.keys(currencyNames[language]) as CurrencyCode[]).map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
          <button className="currency-swap" onClick={swapCurrencies} aria-label={labels.swap}><ArrowRightLeft size={18} /></button>
          <label><span>{currencyNames[language][toCurrency]}</span><select value={toCurrency} onChange={(event) => setToCurrency(event.target.value as CurrencyCode)} aria-label={currencyNames[language][toCurrency]}>{(Object.keys(currencyNames[language]) as CurrencyCode[]).map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
        </div>
        <div className="currency-result"><small>{loadingFx ? labels.loading : fxRates ? `${amount || "0"} ${fromCurrency} =` : labels.unavailable}</small><strong>{convertedAmount === null ? "—" : `${convertedAmount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${toCurrency}`}</strong></div>
        <button className="currency-refresh" onClick={() => void loadFxRates()}><RefreshCw size={14} /> {labels.convert}</button>
      </div>}
      {translationOpen && <div className="translation-overlay" role="presentation" onClick={() => setTranslationOpen(false)}>
        <div className="translation-dialog" role="dialog" aria-modal="true" aria-label={labels.translate} onClick={(event) => event.stopPropagation()}>
          <div className="translation-dialog-head"><div><span className="section-eyebrow">ALASSAUL · LANGUAGES</span><h3>{labels.translate}</h3></div><button onClick={() => setTranslationOpen(false)} aria-label={labels.close}><X size={18} /></button></div>
          <p className="translation-dialog-intro">اختر لغة النص الذي ستكتبه، ثم اختر اللغة التي تريد ظهور النتيجة بها.</p>
          <span className="translation-field-title">لغة النص</span>
          <div className="translation-dialog-options"><button className={translationSource === "AR" ? "active" : ""} onClick={() => { setTranslationSource("AR"); if (translationTarget === "AR") setTranslationTarget("TR"); }}>العربية <small>AR</small></button><button className={translationSource === "TR" ? "active" : ""} onClick={() => { setTranslationSource("TR"); if (translationTarget === "TR") setTranslationTarget("AR"); }}>Türkçe <small>TR</small></button><button className={translationSource === "EN" ? "active" : ""} onClick={() => { setTranslationSource("EN"); if (translationTarget === "EN") setTranslationTarget("AR"); }}>English <small>EN</small></button></div>
          <span className="translation-field-title">الترجمة إلى</span>
          <div className="translation-dialog-options"><button className={translationTarget === "AR" ? "active" : ""} onClick={() => setTranslationTarget("AR")}>العربية <small>AR</small></button><button className={translationTarget === "TR" ? "active" : ""} onClick={() => setTranslationTarget("TR")}>Türkçe <small>TR</small></button><button className={translationTarget === "EN" ? "active" : ""} onClick={() => setTranslationTarget("EN")}>English <small>EN</small></button></div>
          <label className="translation-input-label" htmlFor="translation-input">النص المراد ترجمته</label>
          <div className="translation-input-wrap"><textarea id="translation-input" className="translation-input" value={translationInput} onChange={(event) => setTranslationInput(event.target.value)} placeholder="اكتب النص هنا…" rows={3} /><button type="button" className={`translation-mic ${translationListening ? "is-listening" : ""}`} onClick={startTranslationVoice} aria-label={translationListening ? "إيقاف الاستماع للترجمة" : "التحدث للترجمة"} title="تحدث للترجمة">{translationListening ? <VolumeX size={17} /> : <Mic size={17} />}</button></div>
          <div className="translation-actions"><button className="translation-submit" onClick={translateText} disabled={translationLoading}><Languages size={15} /> {translationLoading ? "جارٍ الترجمة…" : "ترجم الآن"}</button>{translationResult && !translationLoading && <button type="button" className="translation-speak" onClick={speakTranslation} aria-label={translationSpeaking ? "إيقاف نطق الترجمة" : "استمع إلى الترجمة"}>{translationSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}{translationSpeaking ? "إيقاف الصوت" : "استمع"}</button>}</div>
          <a className="translation-google-link" href={googleTranslateUrl} target="_blank" rel="noreferrer" aria-label="فتح ترجمة Google">فتح الترجمة الأصلية في Google Translate ↗</a>
          {translationResult && <div className="translation-result" aria-live="polite"><span>{translationResult}</span><small>تُحدّث الترجمة أثناء الكتابة</small></div>}
        </div>
      </div>}
    </section>
  );
}
