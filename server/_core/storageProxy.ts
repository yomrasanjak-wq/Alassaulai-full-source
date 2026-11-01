import type { Application } from "express";
import { del } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { createMediaItem, deleteMediaItem, listMediaItems } from "../db";
import { storagePut } from "../storage";
import { ENV } from "./env";

export function registerStorageProxy(app: Application) {
  // Temporary, token-guarded production inspection/migration route. Remove after one-time use.
  app.get("/api/__alassaul_neon_admin", async (req, res) => {
    const expectedToken = process.env.ALASSAUL_NEON_MIGRATION_TOKEN;
    const suppliedToken = typeof req.query.token === "string" ? req.query.token : "";
    if (
      process.env.VERCEL_ENV !== "production" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "main" ||
      !expectedToken ||
      suppliedToken !== expectedToken
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
      const action = typeof req.query.action === "string" ? req.query.action : "inspect";

      if (action === "migrate") {
        const statements = [
          `DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('user', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
          `DO $$ BEGIN CREATE TYPE public.control_request_status AS ENUM ('pending', 'reviewed', 'in_progress', 'completed', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
          `CREATE TABLE IF NOT EXISTS public.users (id serial PRIMARY KEY, "openId" varchar(64) NOT NULL UNIQUE, name text, email varchar(320), "loginMethod" varchar(64), role public.user_role NOT NULL DEFAULT 'user', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "lastSignedIn" timestamptz NOT NULL DEFAULT now())`,
          `CREATE TABLE IF NOT EXISTS public."controlRequests" (id serial PRIMARY KEY, title varchar(255) NOT NULL DEFAULT 'طلب جديد', command text NOT NULL, "requesterType" varchar(32) NOT NULL DEFAULT 'visitor', category varchar(32) NOT NULL DEFAULT 'general', priority varchar(16) NOT NULL DEFAULT 'normal', assignee varchar(32), "decisionNote" text, status public.control_request_status NOT NULL DEFAULT 'pending', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
          `CREATE TABLE IF NOT EXISTS public."mediaItems" (id serial PRIMARY KEY, name varchar(255) NOT NULL, url text NOT NULL, "mimeType" varchar(120) NOT NULL, category varchar(32) NOT NULL DEFAULT 'entertainment', "createdAt" timestamptz NOT NULL DEFAULT now())`,
          `CREATE TABLE IF NOT EXISTS public."guestMemories" (id serial PRIMARY KEY, "imageUrl" text, caption text, "createdAt" timestamptz NOT NULL DEFAULT now())`,
        ];
        for (const statement of statements) await sql.query(statement, []);
      }

      if (action === "smoke") {
        let blobUrl: string | undefined;
        let mediaId: number | undefined;
        try {
          const png = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
            "base64",
          );
          const stored = await storagePut("health-check/" + Date.now() + "-alassaul.png", png, "image/png");
          blobUrl = stored.url;
          const uploaded = await fetch(stored.url, { cache: "no-store" });
          const uploadedBytes = Buffer.from(await uploaded.arrayBuffer());
          if (!uploaded.ok || uploadedBytes.length !== png.length) {
            throw new Error("Production Blob readback failed");
          }
          const item = await createMediaItem({
            name: "ALASSAUL temporary media smoke test",
            url: stored.url,
            mimeType: "image/png",
            category: "test",
          });
          if (!item?.id) throw new Error("Production database insert failed");
          mediaId = item.id;
          const listed = await listMediaItems("test");
          const found = listed.some((entry) => entry.id === mediaId);
          if (!found) throw new Error("Production database readback failed");
          res.set("Cache-Control", "no-store");
          res.status(200).json({ ok: true, blobUpload: "success", blobReadback: "success", databaseInsert: "success", databaseReadback: "success" });
        } finally {
          if (mediaId) await deleteMediaItem(mediaId).catch((error) => console.error("[NeonAdmin] DB cleanup failed:", error));
          if (blobUrl) await del(blobUrl).catch((error) => console.error("[NeonAdmin] Blob cleanup failed:", error));
        }
        return;
      }

      const tables = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      res.set("Cache-Control", "no-store");
      res.status(200).json({ ok: true, action, tables: tables.map((row) => row.table_name) });
    } catch (error) {
      console.error("[NeonAdmin] operation failed:", error);
      res.status(502).json({ ok: false, error: "Neon database operation failed" });
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
        headers: { Authorization: "Bearer " + ENV.storageApiKey },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error("[StorageProxy] forge error: " + forgeResp.status + " " + body);
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
