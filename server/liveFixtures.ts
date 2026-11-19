export type SaudiLeagueFixture = {
  week: string;
  date: string;
  time: string;
  home: string;
  away: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

const ARABIC_MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, أغسطس: 8, اغسطس: 8, سبتمبر: 9, أكتوبر: 10, اكتوبر: 10,
  نوفمبر: 11, ديسمبر: 12,
};

function arabicFixtureDate(day: string, monthName: string): string | undefined {
  const month = ARABIC_MONTHS[monthName];
  if (!month) return undefined;
  const now = new Date();
  let year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Riyadh", year: "numeric" }).format(now));
  const currentMonth = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Riyadh", month: "numeric" }).format(now));
  if (month < currentMonth - 1) year += 1;
  const date = new Date(Date.UTC(year, month - 1, Number(day)));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== Number(day)) return undefined;
  return year + "-" + String(month).padStart(2, "0") + "-" + String(Number(day)).padStart(2, "0");
}

/**
 * Parse server-rendered official SPL fixture cards in English or Arabic.
 * Only complete rows with both clubs and a valid date/time are returned.
 */
export function parseOfficialSaudiLeagueFixturesHtml(html: string): SaudiLeagueFixture[] {
  const decoded = decodeHtml(
    html.replace(/\\u0026/gi, "&").replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">").replace(/\\u0027/gi, "'"),
  );
  const text = decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\["']/g, "")
    .replace(/\s+/g, " ");
  const fixtures: SaudiLeagueFixture[] = [];
  const seen = new Set<string>();
  const add = (week: string, date: string | undefined, time: string, home: string, away: string) => {
    const cleanHome = home.trim().replace(/^["']|["']$/g, "");
    const cleanAway = away.trim().replace(/^["']|["']$/g, "");
    if (!date || !/^[0-9]{2}:[0-9]{2}$/.test(time) || !cleanHome || !cleanAway) return;
    const key = [week, date, time, cleanHome, cleanAway].join("|").toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    fixtures.push({ week, date, time, home: cleanHome, away: cleanAway });
  };

  const english = /MATCHWEEK\s*(\d+)\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})\s*Home team:\s*([^.;]+?)\.?\s*Away team:\s*([^.;]+?)\.?\s*Upcoming match/gi;
  for (const match of text.matchAll(english)) add(match[1], match[2], match[3], match[4], match[5]);

  const arabic = /الجولة\s*(\d+)\s*(?:(?:الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت|الأحد|الاحد)\s*[،,]?\s*)?(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s*(\d{1,2}:\d{2})\s*الفريق المستضيف:\s*([^.;]+?)\.?\s*الفريق الضيف:\s*([^.;]+?)\.?\s*مباراة قادمة/gi;
  for (const match of text.matchAll(arabic)) add(match[1], arabicFixtureDate(match[2], match[3]), match[4], match[5], match[6]);

  const arabicHomeCards = /(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s*(\d{1,2}:\d{2})\s*الجولة\s*(\d+)[\s\S]{0,180}?الفريق المستضيف:\s*([^.;]+?)\.?\s*الفريق الضيف:\s*([^.;]+?)\.?\s*مباراة قادمة/gi;
  for (const match of text.matchAll(arabicHomeCards)) add(match[4], arabicFixtureDate(match[1], match[2]), match[3], match[5], match[6]);

  return fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
