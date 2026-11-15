import { describe, expect, it } from "vitest";
import { parseOfficialSaudiLeagueFixturesHtml } from "./liveFixtures";

describe("parseOfficialSaudiLeagueFixturesHtml", () => {
  it("parses Arabic fixture rows from the official fixtures page text", () => {
    const html = `
      <main>
        الجولة 13 2026-11-26 14:25الفريق المستضيف: الفتح.الفريق الضيف: الرياض.مباراة قادمة.
        الجولة 13 2026-11-26 15:05الفريق المستضيف: أبها.الفريق الضيف: الشباب.مباراة قادمة.
      </main>`;
    expect(parseOfficialSaudiLeagueFixturesHtml(html)).toEqual([
      { week: "13", date: "2026-11-26", time: "14:25", home: "الفتح", away: "الرياض" },
      { week: "13", date: "2026-11-26", time: "15:05", home: "أبها", away: "الشباب" },
    ]);
  });

  it("parses English rows embedded in HTML script data", () => {
    const html = `<script>window.__DATA__ = "MATCHWEEK 14 2026-12-03 14:40 Home team: Al Shabab. Away team: Al Ettifaq. Upcoming match";</script>`;
    expect(parseOfficialSaudiLeagueFixturesHtml(html)).toContainEqual({
      week: "14", date: "2026-12-03", time: "14:40", home: "Al Shabab", away: "Al Ettifaq",
    });
  });

  it("does not invent fixtures when the page has no match rows", () => {
    expect(parseOfficialSaudiLeagueFixturesHtml("<main>لا توجد بيانات حاليا</main>")).toEqual([]);
  });
});
