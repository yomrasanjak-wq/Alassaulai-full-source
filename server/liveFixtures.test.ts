import { describe, expect, it } from "vitest";
import { parseOfficialSaudiLeagueFixturesHtml } from "./liveFixtures";

describe("parseOfficialSaudiLeagueFixturesHtml", () => {
  it("parses English fixture cards from the official fixtures page", () => {
    const html = `
      <main>
        MATCHWEEK 14 2026-12-03 14:40 Home team: Al Shabab. Away team: Al Ettifaq. Upcoming match
        MATCHWEEK 14 2026-12-03 14:45 Home team: Al Taawoun. Away team: Abha. Upcoming match
      </main>`;
    expect(parseOfficialSaudiLeagueFixturesHtml(html)).toEqual([
      { week: "14", date: "2026-12-03", time: "14:40", home: "Al Shabab", away: "Al Ettifaq" },
      { week: "14", date: "2026-12-03", time: "14:45", home: "Al Taawoun", away: "Abha" },
    ]);
  });

  it("parses Arabic fixture cards with weekday and month names", () => {
    const html = `
      <main>
        الجولة 13 الخميس, 26 نوفمبر 17:25الفريق المستضيف: الفتح.الفريق الضيف: الرياض.مباراة قادمة.
        الجولة 13 الخميس, 26 نوفمبر 18:05الفريق المستضيف: أبها.الفريق الضيف: الشباب.مباراة قادمة.
      </main>`;
    expect(parseOfficialSaudiLeagueFixturesHtml(html)).toEqual([
      { week: "13", date: "2026-11-26", time: "17:25", home: "الفتح", away: "الرياض" },
      { week: "13", date: "2026-11-26", time: "18:05", home: "أبها", away: "الشباب" },
    ]);
  });

  it("does not invent fixtures when the page has no match rows", () => {
    expect(parseOfficialSaudiLeagueFixturesHtml("<main>لا توجد بيانات حاليا</main>")).toEqual([]);
  });
});
