import { del, put } from "@vercel/blob";
import type { Express } from "express";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  // Temporary, preview-only smoke test. It writes one tiny PNG, reads it back,
  // then deletes it. This route is disabled outside this exact test branch.
  app.get("/api/__alassaul_blob_readback", async (_req, res) => {
    if (
      process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feat/vercel-blob-media-storage"
    ) {
      res.status(404).end();
      return;
    }

    let blobUrl: string | undefined;
    try {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
        "base64",
      );
      const blob = await put("health-check/alassaul-storage-smoke.png", png, {
        access: "public",
        addRandomSuffix: true,
        contentType: "image/png",
      });
      blobUrl = blob.url;
      const response = await fetch(blob.url, { cache: "no-store" });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!response.ok || bytes.length !== png.length) {
        throw new Error(`Blob readback failed: HTTP ${response.status}, ${bytes.length} bytes`);
      }
      res.status(200).json({ ok: true, upload: "success", readback: "success", bytes: bytes.length });
    } catch (error) {
      console.error("[BlobSmokeTest] failed:", error);
      res.status(502).json({ ok: false, error: "Blob upload/readback failed" });
    } finally {
      if (blobUrl) {
        await del(blobUrl).catch((error) => console.error("[BlobSmokeTest] cleanup failed:", error));
      }
    }
  });

  app.get(["/manus-storage/*", "/api/manus-storage/*"], async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.storageApiUrl || !ENV.storageApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.storageApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.storageApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
