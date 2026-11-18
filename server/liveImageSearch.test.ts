import { afterEach, describe, expect, it, vi } from "vitest";
import { getWikimediaImageAnswer, isWikimediaImageRequest } from "./liveImageSearch";

afterEach(() => vi.unstubAllGlobals());

const historyForMakkah = [{ role: "user" as const, content: "ابغى صوره لمكه المكرمه" }];

describe("context-aware live image search", () => {
  it("recognizes Hamsikoy spellings, Toyota Sequoia, and flower bouquet requests", () => {
    expect(isWikimediaImageRequest("اريد صوره لهمسكوي")).toBe(true);
    expect(isWikimediaImageRequest("اعرض لي صوره لسياره ساكويا 2010")).toBe(true);
    expect(isWikimediaImageRequest("ابغى صوره لباقه ورد جميله")).toBe(true);
  });

  it("does not reject English Openverse titles for an Arabic free-text request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          title: "Beautiful fresh flower bouquet",
          thumbnail: "https://api.openverse.org/v1/images/33333333-3333-4333-8333-333333333333/thumb/",
          foreign_landing_url: "https://example.org/flowers",
          license: "cc-by",
          indexed_on: "2026-11-17T10:00:00Z",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("ابغى صوره لباقه ورد جميله");
    expect(answer).toContain("![باقة ورد جميلة]");
    expect(answer).toContain("33333333-3333-4333-8333-333333333333");
  });

  it("recognizes common Arabic image requests and ignores image display complaints without context", () => {
    expect(isWikimediaImageRequest("طيب صوره لمكه المكرمه")).toBe(true);
    expect(isWikimediaImageRequest("صوره للفنان محمد عبده")).toBe(true);
    expect(isWikimediaImageRequest("صورة مركب بجوار أوزنجول")).toBe(true);
    expect(isWikimediaImageRequest("صوره للاعب المعتزل ماجد عبدالله")).toBe(true);
    expect(isWikimediaImageRequest("صوره للفنان محمد علي سندي")).toBe(true);
    expect(isWikimediaImageRequest("صورة لشعار نادي الاتحاد السعودي")).toBe(true);
    expect(isWikimediaImageRequest("طيب اعرض لي صوره تظهر جمال طرابزون")).toBe(true);
    expect(isWikimediaImageRequest("ابغى صوره للميدان")).toBe(true);
    expect(isWikimediaImageRequest("ابغى منظر الهمسه كوي")).toBe(true);
    expect(isWikimediaImageRequest("اعرض صورة للهمسة كوي")).toBe(true);
    expect(isWikimediaImageRequest("طيب الصورة ما طلعت")).toBe(false);
    expect(isWikimediaImageRequest("السلام عليكم")).toBe(false);
  });

  it("carries the previous image subject into a modern/colorful image follow-up", () => {
    expect(isWikimediaImageRequest("ابغى صوره ملونه حديثه يا اخي", historyForMakkah)).toBe(true);
    expect(isWikimediaImageRequest("ابحث في جوجل تطلع صور حديثه", historyForMakkah)).toBe(true);
    expect(isWikimediaImageRequest("كل الصور حقتك قديمه ما في صوره حديثه", historyForMakkah)).toBe(true);
  });

  it("normalizes regional place names to reliable image-search subjects", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const airport = await getWikimediaImageAnswer("ابغى صوره لمطار ريزا");
    expect(airport).toContain("مطار ريزا-أرتفين");
    expect(airport).toContain("Rize%20Artvin%20Airport");

    fetchMock.mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    const plateau = await getWikimediaImageAnswer("اريد صوره منظر لحيدر نبي");
    expect(plateau).toContain("مرتفعات حيدر نبي");
    expect(plateau).toContain("Hidirnebi");

    fetchMock.mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    const sulfur = await getWikimediaImageAnswer("ابغى صوره للمياه الكبريتيه في جرسون");
    expect(sulfur).toContain("المياه الكبريتية في منتزه كوزالان");
    expect(sulfur).toContain("Kuzalan");
  });

  it("understands natural Trabzon scenery and its Meydan square", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const trabzon = await getWikimediaImageAnswer("طيب اعرض لي صوره تظهر جمال طرابزون");
    expect(trabzon).toContain("طرابزون");
    expect(trabzon).toContain("Trabzon%20Turkey");

    fetchMock.mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    const meydan = await getWikimediaImageAnswer("ابغى صوره للميدان");
    expect(meydan).toContain("ميدان طرابزون");
    expect(meydan).toContain("Trabzon%20Meydan%20Square");
  });

  it("keeps a new Hamsikoy request separate from an older car image request", async () => {
    const oldHistory = [{ role: "user" as const, content: "صورة لسيارة ساكويا تويوتا 2010" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("ابغى منظر الهمسه كوي", "AR", oldHistory);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("Hamsikoy");
    expect(answer).toContain("همسي كوي");
    expect(answer).not.toContain("ساكويا");
  });

  it("uses a scene-specific query for a boat beside Uzungol", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("صورة مركب بجوار أوزنجول");
    expect(fetchMock.mock.calls[0][0]).toContain("Uzungol+lake+boat");
    expect(answer).toContain("قارب بجوار بحيرة أوزنجول");
  });

  it("rejects an unrelated historical map returned for a city image query", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: [{
        title: "File:1866 Johnson Map of Arabia Persia Turkey.jpg",
        imageinfo: [{ url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/old-map.jpg",
          descriptionurl: "https://commons.wikimedia.org/wiki/File:old-map.jpg", mime: "image/jpeg" }],
      }] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("اعرض لي صوره عن طرابزون");
    expect(answer).not.toContain("old-map.jpg");
    expect(answer).toContain("لم أجد صورة مناسبة الآن.");
  });

  it("shows a Commons image with a clean title and source link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: [{
        title: "File:Masjid al-Haram.jpg",
        imageinfo: [{
          thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Masjid.jpg/960px-Masjid.jpg",
          url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Masjid.jpg",
          descriptionurl: "https://commons.wikimedia.org/wiki/File:Masjid_al-Haram.jpg",
          mime: "image/jpeg",
          extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "Example Photographer" } },
        }],
      }] } }) ,
    });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("صوره لمكه المكرمه");
    expect(answer).toContain("![مكة المكرمة والمسجد الحرام](https://upload.wikimedia.org/wikipedia/commons/a/ab/Masjid.jpg)");
    expect(answer).toContain("**مكة المكرمة والمسجد الحرام**");
    expect(answer).toContain("[المصدر](https://commons.wikimedia.org/wiki/File:Masjid_al-Haram.jpg)");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses Openverse for modern requests and links to recent Google Images results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          title: "Masjid al-Haram recent view",
          thumbnail: "https://api.openverse.org/v1/images/4bc43a04-ef46-4544-a0c1-63c63f56e276/thumb/",
          foreign_landing_url: "https://example.org/photo",
          creator: "Example Photographer",
          license: "cc-by",
          license_version: "4.0",
          license_url: "https://creativecommons.org/licenses/by/4.0/",
          indexed_on: "2026-01-12T10:00:00Z",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("ابغى صوره ملونه حديثه يا اخي", "AR", historyForMakkah);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("api.openverse.org/v1/images/");
    expect(answer).toContain("![Masjid al-Haram recent view](https://api.openverse.org/");
    expect(answer).toContain("صور Google الحديثة");
    expect(answer).toContain("تاريخ التقاط الصورة");
  });

  it("prefers a relevant Openverse image over a newer unrelated result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "Unrelated mountain festival",
            thumbnail: "https://api.openverse.org/v1/images/11111111-1111-4111-8111-111111111111/thumb/",
            foreign_landing_url: "https://example.org/unrelated",
            license: "cc-by",
            indexed_on: "2026-11-17T10:00:00Z",
          },
          {
            title: "Trabzon Black Sea city view",
            thumbnail: "https://api.openverse.org/v1/images/22222222-2222-4222-8222-222222222222/thumb/",
            foreign_landing_url: "https://example.org/trabzon",
            license: "cc-by",
            indexed_on: "2025-01-01T10:00:00Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("اعرض لي صوره عن طرابزون");
    expect(answer).toContain("Trabzon Black Sea city view");
    expect(answer).toContain("22222222-2222-4222-8222-222222222222");
    expect(answer).not.toContain("11111111-1111-4111-8111-111111111111");
  });

  it("recognizes Saudi singer Mohammed Ali Sindi", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("صوره للفنان محمد علي سندي");
    expect(answer).toContain("الفنان محمد علي سندي");
    expect(answer).toContain("Mohammed%20Ali%20Sindi");
  });

  it("distinguishes a footballer named Mohammed Abdu and recognizes former Al Ittihad player Mohammed Noor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const abdu = await getWikimediaImageAnswer("صورة اللاعب محمد عبده");
    expect(abdu).toContain("اللاعب محمد عبده");
    expect(abdu).toContain("Mohammed%20Abdu%20Saudi%20football%20player");

    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: [] } }) });
    const noor = await getWikimediaImageAnswer("صورة اللاعب الاتحاد المعتزل محمد نور");
    expect(noor).toContain("اللاعب محمد نور");
    expect(noor).toContain("Mohammed%20Noor%20Saudi%20footballer");
  });

  it("falls back to Google Images rather than inventing a result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("صوره للاعب المعتزل ماجد عبدالله");
    expect(answer).toBe("لم أجد صورة مناسبة الآن.");
    expect(answer).not.toContain("![");
  });
});
