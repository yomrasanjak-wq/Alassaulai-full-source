import type { Express } from "express";
import { neon } from "@neondatabase/serverless";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  // Temporary, preview-only, additive migration for the app tables missing from Neon.
  app.post("/api/__alassaul_db_migrate", async (_req, res) => {
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
      const statements = [
        `DO $ BEGIN CREATE TYPE public.user_role AS ENUM ('user', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $`,
        `DO $ BEGIN CREATE TYPE public.control_request_status AS ENUM ('pending', 'reviewed', 'in_progress', 'completed', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $`,
        `CREATE TABLE IF NOT EXISTS public.users (id serial PRIMARY KEY, "openId" varchar(64) NOT NULL UNIQUE, name text, email varchar(320), "loginMethod" varchar(64), role public.user_role NOT NULL DEFAULT 'user', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "lastSignedIn" timestamptz NOT NULL DEFAULT now())`,
        `CREATE TABLE IF NOT EXISTS public."controlRequests" (id serial PRIMARY KEY, title varchar(255) NOT NULL DEFAULT 'طلب جديد', command text NOT NULL, "requesterType" varchar(32) NOT NULL DEFAULT 'visitor', category varchar(32) NOT NULL DEFAULT 'general', priority varchar(16) NOT NULL DEFAULT 'normal', assignee varchar(32), "decisionNote" text, status public.control_request_status NOT NULL DEFAULT 'pending', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
        `CREATE TABLE IF NOT EXISTS public."mediaItems" (id serial PRIMARY KEY, name varchar(255) NOT NULL, url text NOT NULL, "mimeType" varchar(120) NOT NULL, category varchar(32) NOT NULL DEFAULT 'entertainment', "createdAt" timestamptz NOT NULL DEFAULT now())`,
        `CREATE TABLE IF NOT EXISTS public."guestMemories" (id serial PRIMARY KEY, "imageUrl" text, caption text, "createdAt" timestamptz NOT NULL DEFAULT now())`,
      ];
      for (const statement of statements) await sql.query(statement, []);
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
