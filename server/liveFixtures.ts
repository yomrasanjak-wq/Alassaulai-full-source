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

/**
 * Parse both the visible-text representation and embedded hydration/JSON-LD
 * payloads returned by the official SPL fixtures page. This deliberately
 * accepts only rows containing a date, kick-off time, home team and away team.
 */
export function parseOfficialSaudiLeagueFixturesHtml(html: string): SaudiLeagueFixture[] {
  const decoded = decodeHtml(html.replace(/\\u0026/gi, "&").replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">").replace(/\\u0027/gi, "'"));
  const text = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\\["']/g, "")
    .replace(/\\s+/g, " ");
  const patterns = [
    /(?:MATCHWEEK|الجولة)\\s*(\\d+)\\s*(\\d{4}-\\d{2}-\\d{2})\\s*(\\d{2}:\\d{2})\\s*(?:Home team|الفريق المستضيف)\\s*:\\s*([^.;]+?)\\.?\\s*(?:Away team|الفريق الضيف)\\s*:\\s*([^.;]+?)\\.?\\s*(?:Upcoming match|مباراة قادمة)/gi,
    /(?:MATCHWEEK|الجولة)\\s*(\\d+)\\s*(\\d{4}-\\d{2}-\\d{2})\\s*(\\d{2}:\\d{2})\\s*([^.;]+?)\\s+(?:VS|×|ضد)\\s+([^.;]+?)\\s*(?:Upcoming match|مباراة قادمة)/gi,
  ];
  const fixtures: SaudiLeagueFixture[] = [];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const [, week, date, time, rawHome, rawAway] = match;
      const home = rawHome.trim().replace(/^["']|["']$/g, "");
      const away = rawAway.trim().replace(/^["']|["']$/g, "");
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^\\d{2}:\\d{2}$/.test(time) || !home || !away) continue;
      const key = [week, date, time, home, away].join("|").toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fixtures.push({ week, date, time, home, away });
    }
  }
  return fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
