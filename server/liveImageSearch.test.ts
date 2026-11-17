import { afterEach, describe, expect, it, vi } from "vitest";
import { getWikimediaImageAnswer, isWikimediaImageRequest } from "./liveImageSearch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Wikimedia Commons image search", () => {
  it("recognizes Arabic image requests for Makkah and public figures", () => {
    expect(isWikimediaImageRequest("طيب صوره لمكه المكرمه")).toBe(true);
    expect(isWikimediaImageRequest("صوره للفنان محمد عبده")).toBe(true);
    expect(isWikimediaImageRequest("السلام عليكم")).toBe(false);
  });

  it("returns a displayable image with source and license attribution", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: [{
            title: "File:Masjid al-Haram.jpg",
            imageinfo: [{
              thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Masjid.jpg/960px-Masjid.jpg",
              url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Masjid.jpg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Masjid_al-Haram.jpg",
              mime: "image/jpeg",
              extmetadata: {
                LicenseShortName: { value: "CC BY-SA 4.0" },
                Artist: { value: "Example Photographer" },
              },
            }],
          }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const answer = await getWikimediaImageAnswer("صوره لمكه المكرمه");
    expect(answer).toContain("![مكة المكرمة والمسجد الحرام](https://upload.wikimedia.org/");
    expect(answer).toContain("CC BY-SA 4.0");
    expect(answer).toContain("https://commons.wikimedia.org/wiki/File:Masjid_al-Haram.jpg");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not render arbitrary external image hosts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: [{
            title: "File:Not trusted.jpg",
            imageinfo: [{
              thumburl: "https://example.com/image.jpg",
              url: "https://example.com/image.jpg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Not_trusted.jpg",
              mime: "image/jpeg",
            }],
          }],
        },
      }),
    }));

    const answer = await getWikimediaImageAnswer("صوره للفنان محمد عبده");
    expect(answer).toContain("لم أجد ملفاً مناسباً");
    expect(answer).not.toContain("![");
  });
});
