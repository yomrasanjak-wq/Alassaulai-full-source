import { afterEach, describe, expect, it, vi } from "vitest";
import { getWikimediaImageAnswer, isWikimediaImageRequest } from "./liveImageSearch";

afterEach(() => vi.unstubAllGlobals());

const historyForMakkah = [{ role: "user" as const, content: "ابغى صوره لمكه المكرمه" }];

describe("context-aware live image search", () => {
  it("recognizes common Arabic image requests and ignores image display complaints without context", () => {
    expect(isWikimediaImageRequest("طيب صوره لمكه المكرمه")).toBe(true);
    expect(isWikimediaImageRequest("صوره للفنان محمد عبده")).toBe(true);
    expect(isWikimediaImageRequest("صورة مركب بجوار أوزنجول")).toBe(true);
    expect(isWikimediaImageRequest("صوره للاعب المعتزل ماجد عبدالله")).toBe(true);
    expect(isWikimediaImageRequest("صورة لشعار نادي الاتحاد السعودي")).toBe(true);
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

  it("uses a scene-specific query for a boat beside Uzungol", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("صورة مركب بجوار أوزنجول");
    expect(fetchMock.mock.calls[0][0]).toContain("Uzungol+lake+boat");
    expect(answer).toContain("قارب بجوار بحيرة أوزنجول");
  });

  it("keeps Commons images with source and license attribution", async () => {
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
    expect(answer).toContain("![مكة المكرمة والمسجد الحرام](https://upload.wikimedia.org/");
    expect(answer).toContain("CC BY-SA 4.0");
    expect(answer).toContain("https://commons.wikimedia.org/wiki/File:Masjid_al-Haram.jpg");
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

  it("falls back to Google Images rather than inventing a result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await getWikimediaImageAnswer("صوره للاعب المعتزل ماجد عبدالله");
    expect(answer).toContain("google.com/search?tbm=isch");
    expect(answer).toContain("ماجد عبدالله");
    expect(answer).not.toContain("![");
  });
});
