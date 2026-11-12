import { count, desc, eq, ilike, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  ControlRequest,
  GuestMemory,
  InsertUser,
  User,
  MediaItem,
  controlRequests,
  controlAuditLogs,
  guestMemories,
  mediaItems,
  users,
} from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _controlRoomSchemaReady: Promise<void> | null = null;

/**
 * Apply the small additive control-room schema extension on the first owner-only
 * team read. This uses the already-configured Vercel DATABASE_URL, so no database
 * credential is copied into GitHub Actions or exposed to the browser.
 */
export async function ensureControlRoomSchema(): Promise<void> {
  if (_controlRoomSchemaReady) return _controlRoomSchemaReady;
  _controlRoomSchemaReady = (async () => {
    if (!ENV.databaseUrl) throw new Error("قاعدة البيانات غير مهيأة على الخادم.");
    const sql = neon(ENV.databaseUrl);
    const statements = [
      "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'secretary'",
      "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'assistant'",
      "ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'it'",
      'CREATE INDEX IF NOT EXISTS control_requests_assignee_created_idx ON public."controlRequests" (assignee, "createdAt" DESC)',
      'CREATE TABLE IF NOT EXISTS public."controlAuditLogs" (id serial PRIMARY KEY, "actorOpenId" varchar(64) NOT NULL, action varchar(80) NOT NULL, "targetType" varchar(40) NOT NULL, "targetId" varchar(80), details text, "createdAt" timestamptz NOT NULL DEFAULT now())',
      'CREATE INDEX IF NOT EXISTS control_audit_logs_created_idx ON public."controlAuditLogs" ("createdAt" DESC)',
    ];
    for (const statement of statements) await sql.query(statement, []);
  })();
  try {
    await _controlRoomSchemaReady;
  } catch (error) {
    _controlRoomSchemaReady = null;
    throw error;
  }
}

// Neon HTTP avoids opening TCP connections from short-lived Vercel functions.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      const sql = neon(ENV.databaseUrl);
      _db = drizzle({ client: sql, schema });
    } catch (error) {
      console.warn("[Database] Failed to initialize Neon client:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Partial<InsertUser> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= values.lastSignedIn;
  updateSet.updatedAt = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listControlRequestsForAssignee(assignee: string): Promise<ControlRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(controlRequests).where(eq(controlRequests.assignee, assignee)).orderBy(desc(controlRequests.createdAt)).limit(100);
}

export async function listControlTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn })
    .from(users).orderBy(desc(users.lastSignedIn)).limit(100);
}

export async function updateUserRoleByEmail(email: string, role: User["role"]) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db.select({ id: users.id }).from(users).where(ilike(users.email, email)).limit(1);
  if (!existing[0]) return undefined;
  const rows = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, existing[0].id)).returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  return rows[0];
}

export async function createControlAuditLog(input: { actorOpenId: string; action: string; targetType: string; targetId?: string; details?: string; }) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.insert(controlAuditLogs).values(input).returning();
  return rows[0];
}

export async function listControlAuditLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(controlAuditLogs).orderBy(desc(controlAuditLogs.createdAt)).limit(50);
}

export async function getSystemHealth() {
  const checkedAt = new Date();
  const db = await getDb();
  if (!db) return { application: "healthy" as const, database: "down" as const, checkedAt };
  try {
    await db.execute(sql.raw("select 1 as ok"));
    return { application: "healthy" as const, database: "healthy" as const, checkedAt };
  } catch {
    return { application: "healthy" as const, database: "down" as const, checkedAt };
  }
}

export async function countRegisteredVisitors(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count() }).from(users);
  return Number(result[0]?.total ?? 0);
}

export async function createControlRequest(
  input: Pick<ControlRequest, "title" | "command" | "requesterType" | "category" | "priority"> & { assignee?: string },
): Promise<ControlRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.insert(controlRequests).values(input).returning();
  return rows[0];
}

export async function listControlRequests(): Promise<ControlRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(controlRequests).orderBy(desc(controlRequests.createdAt)).limit(100);
}

export async function updateControlRequest(
  id: number,
  input: Partial<Pick<ControlRequest, "status" | "assignee" | "decisionNote">>,
): Promise<ControlRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(controlRequests).set({ ...input, updatedAt: new Date() }).where(eq(controlRequests.id, id));
  const rows = await db.select().from(controlRequests).where(eq(controlRequests.id, id)).limit(1);
  return rows[0];
}

export async function createMediaItem(input: {
  name: string;
  url: string;
  mimeType: string;
  category?: string;
}): Promise<MediaItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.insert(mediaItems).values(input).returning();
  return rows[0];
}

export async function listMediaItems(category?: string): Promise<MediaItem[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const query = db.select().from(mediaItems).orderBy(desc(mediaItems.createdAt)).limit(100);
    return category ? query.where(eq(mediaItems.category, category)) : query;
  } catch (error) {
    const detail = error as {
      name?: string;
      code?: string;
      message?: string;
      cause?: { name?: string; code?: string; message?: string };
    };
    console.error("[Database] listMediaItems failed", {
      name: detail.name,
      code: detail.code,
      message: detail.message,
      cause: detail.cause
        ? { name: detail.cause.name, code: detail.cause.code, message: detail.cause.message }
        : undefined,
    });
    throw error;
  }
}

export async function updateMediaItem(id: number, name: string): Promise<MediaItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(mediaItems).set({ name }).where(eq(mediaItems.id, id));
  const rows = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
  return rows[0];
}

export async function deleteMediaItem(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(mediaItems).where(eq(mediaItems.id, id));
  return true;
}

export async function createGuestMemory(input: {
  imageUrl?: string;
  caption?: string;
}): Promise<GuestMemory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.insert(guestMemories).values(input).returning();
  return rows[0];
}

export async function listGuestMemories(): Promise<GuestMemory[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(guestMemories).orderBy(desc(guestMemories.createdAt)).limit(100);
  } catch (error) {
    const detail = error as {
      name?: string;
      code?: string;
      message?: string;
      cause?: { name?: string; code?: string; message?: string };
    };
    console.error("[Database] listGuestMemories failed", {
      name: detail.name,
      code: detail.code,
      message: detail.message,
      cause: detail.cause
        ? { name: detail.cause.name, code: detail.cause.code, message: detail.cause.message }
        : undefined,
    });
    throw error;
  }
}

export async function deleteGuestMemory(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(guestMemories).where(eq(guestMemories.id, id));
  return true;
}
