import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, MapPin, Navigation, Plus, Route, Trash2 } from "lucide-react";

type Stop = { id: string; name: string; area: string; query: string };
const PLACES: Stop[] = [
  { id: "meydan", name: "ميدان طرابزون", area: "طرابزون", query: "Trabzon Meydan Parkı" },
  { id: "ganita", name: "شاطئ قانيتا", area: "طرابزون", query: "Ganita Sahili Trabzon" },
  { id: "boztepe", name: "بوزتبه والمطل", area: "طرابزون", query: "Boztepe Trabzon" },
  { id: "sera", name: "بحيرة سيرا", area: "أكشابات", query: "Sera Golu Trabzon" },
  { id: "sumela", name: "دير سوميلا", area: "ماتشكا", query: "Sumela Monastery Trabzon" },
  { id: "uzungol", name: "أوزنجول", area: "تشايكارا", query: "Uzungol Trabzon" },
  { id: "kasustu", name: "ممشى كاشوستو", area: "يومرا", query: "Kasustu Sahil Yomra" },
  { id: "cevahir", name: "مركز جواهر", area: "يومرا", query: "Cevahir Outlet Trabzon" },
  { id: "ayder", name: "مرتفعات آيدر", area: "ريزا", query: "Ayder Yaylasi Rize" },
];
export function DayRoutePlanner() {
  const [origin, setOrigin] = useState("Trabzon, Turkey");
  const [selected, setSelected] = useState<Stop[]>([]);
  const [pick, setPick] = useState("");
  const available = useMemo(() => PLACES.filter((p) => !selected.some((s) => s.id === p.id)), [selected]);
  const add = () => { const place = PLACES.find((p) => p.id === pick); if (place && !selected.some((s) => s.id === place.id) && selected.length < 8) setSelected((prev) => [...prev, place]); setPick(""); };
  const move = (index: number, direction: -1 | 1) => setSelected((prev) => { const next = [...prev]; const target = index + direction; if (target < 0 || target >= next.length) return prev; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const routeUrl = useMemo(() => {
    if (!selected.length) return "";
    const destination = selected[selected.length - 1];
    const waypoints = selected.slice(0, -1).map((s) => s.query).join("|");
    return "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(origin.trim() || "Trabzon, Turkey") + "&destination=" + encodeURIComponent(destination.query) + (waypoints ? "&waypoints=" + encodeURIComponent(waypoints) : "") + "&travelmode=driving";
  }, [origin, selected]);
  return <section id="day-route-planner" className="day-route-planner section-pad" aria-labelledby="day-route-title">
    <div className="container">
      <div className="day-route-heading"><span className="section-eyebrow"><Route size={15}/> PLAN / خريطة يومك</span><h2 id="day-route-title">رتّب جولتك على مزاجك.</h2><p>اختر محطاتك، رتّب زيارتها، ثم افتح المسار الكامل في الخرائط. يمكنك تعديل القائمة قبل الانطلاق.</p></div>
      <div className="day-route-panel">
        <label className="day-route-origin"><span><Navigation size={15}/> نقطة الانطلاق</span><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="مثال: فندقك أو يومرا"/></label>
        <div className="day-route-add"><label htmlFor="day-route-place">أضف محطة إلى جولتك</label><div><select id="day-route-place" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">اختر وجهة…</option>{available.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.area}</option>)}</select><button type="button" onClick={add} disabled={!pick || selected.length >= 8}><Plus size={16}/> أضف</button></div></div>
        <div className="day-route-stops"><div className="day-route-list-head"><strong>محطات يومك</strong><span>{selected.length} / 8</span></div>
          {selected.length === 0 ? <div className="day-route-empty"><MapPin size={23}/><strong>ابدأ بإضافة أول وجهة</strong><p>سنرتّب محطاتك هنا بالترتيب الذي تختاره.</p></div> : <ol>{selected.map((stop, i) => <li key={stop.id}><span className="day-route-number">{i + 1}</span><span className="day-route-stop-copy"><strong>{stop.name}</strong><small>{stop.area}</small></span><div className="day-route-stop-actions"><button type="button" onClick={() => move(i,-1)} disabled={i===0} aria-label={"تقديم "+stop.name}><ArrowUp size={16}/></button><button type="button" onClick={() => move(i,1)} disabled={i===selected.length-1} aria-label={"تأخير "+stop.name}><ArrowDown size={16}/></button><button type="button" onClick={() => setSelected((prev)=>prev.filter((p)=>p.id!==stop.id))} aria-label={"حذف "+stop.name}><Trash2 size={16}/></button></div></li>)}</ol>}
        </div>
        {selected.length > 0 && <div className="day-route-summary"><Check size={17}/><span>تم تجهيز {selected.length} {selected.length===1?"محطة":"محطات"} حسب ترتيبك. تحقق من الطريق والوقت الفعلي في الخرائط قبل التحرك.</span></div>}
        <div className="day-route-actions"><button type="button" className="button button-primary" disabled={!selected.length} onClick={() => window.open(routeUrl,"_blank","noopener,noreferrer")}><Navigation size={17}/> ابدأ الرحلة وافتح المسار <ExternalLink size={14}/></button><button type="button" className="button button-quiet" disabled={!selected.length} onClick={()=>setSelected([])}>مسح الجولة</button></div>
        <p className="day-route-note">ترتيب المحطات من اختيارك وليس تحسينًا آليًا للمسار. قد لا تتوفر بعض المسارات أو الطرق المغلقة؛ اتبع إرشادات الخرائط المحدثة.</p>
      </div>
    </div>
  </section>;
}
export default DayRoutePlanner;
