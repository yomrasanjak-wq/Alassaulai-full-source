import type { Express } from "express";
import { del } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { createMediaItem, deleteMediaItem, listMediaItems } from "../db";
import { storagePut } from "../storage";
import { NEON_SCHEMA_STATEMENTS } from "./neonSchema";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  // Temporary, preview-only, additive migration for the app tables missing from Neon.
  app.get("/api/__alassaul_db_migrate", async (_req, res) => {
    if (
      process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "fix/neon-postgres-driver"
    ) {
      res.status(404).end();
      return;
    }
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
        return;
      }
      const sql = neon(process.env.DATABASE_URL);
      for (const statement of NEON_SCHEMA_STATEMENTS) await sql.query(statement, []);
      const tables = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      res.set("Cache-Control", "no-store");
      res.status(200).json({ ok: true, createdOrVerified: tables.map((row) => row.table_name) });
    } catch (error) {
      console.error("[NeonMigration] failed:", error);
      res.status(502).json({ ok: false, error: "Neon schema migration failed" });
    }
  });

  // Temporary preview-only integration smoke test; all uploaded data is deleted before returning.
  app.get("/api/__alassaul_media_smoke", async (_req, res) => {
    if (
      process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "fix/neon-postgres-driver"
    ) {
      res.status(404).end();
      return;
    }

    let blobUrl: string | undefined;
    let mediaId: number | undefined;
    try {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
        "base64",
      );
      const stored = await storagePut(`health-check/${Date.now()}-alassaul.png`, png, "image/png");
      blobUrl = stored.url;
      const uploaded = await fetch(stored.url, { cache: "no-store" });
      const uploadedBytes = Buffer.from(await uploaded.arrayBuffer());
      if (!uploaded.ok || uploadedBytes.length !== png.length) {
        throw new Error(`Blob readback failed: HTTP ${uploaded.status}`);
      }

      const item = await createMediaItem({
        name: "ALASSAUL temporary media smoke test",
        url: stored.url,
        mimeType: "image/png",
        category: "test",
      });
      if (!item?.id) throw new Error("Database insert did not return a media ID");
      mediaId = item.id;

      const listed = await listMediaItems("test");
      const databaseReadback = listed.some((entry) => entry.id === mediaId);

      res.set("Cache-Control", "no-store");
      res.status(200).json({
        ok: databaseReadback,
        blobUpload: "success",
        blobReadback: "success",
        databaseInsert: "success",
        databaseReadback: databaseReadback ? "success" : "failed",
      });
    } catch (error) {
      console.error("[MediaSmokeTest] failed:", error);
      res.status(502).json({ ok: false, error: "Media upload/readback integration failed" });
    } finally {
      if (mediaId) await deleteMediaItem(mediaId).catch((error) => console.error("[MediaSmokeTest] DB cleanup failed:", error));
      if (blobUrl) await del(blobUrl).catch((error) => console.error("[MediaSmokeTest] Blob cleanup failed:", error));
    }
  });

  // Temporary read-only schema probe, enabled only on this exact preview branch.
  app.get("/api/__alassaul_db_schema_probe", async (_req, res) => {
    if (
      process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "fix/neon-postgres-driver"
    ) {
      res.status(404).end();
      return;
    }
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ ok: false, error: "DATABASE_URL is not configured" });
        return;
      }
      const sql = neon(process.env.DATABASE_URL);
      const tables = await sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `;
      const columns = await sql`
        SELECT table_schema, table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name, ordinal_position
      `;
      res.set("Cache-Control", "no-store");
      res.status(200).json({ ok: true, tables, columns });
    } catch (error) {
      console.error("[DatabaseSchemaProbe] failed:", error);
      res.status(502).json({ ok: false, error: "Read-only schema inspection failed" });
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
