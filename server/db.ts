import { and, count, desc, eq, gt, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  AssistantMemory,
  ControlRequest,
  GuestMemory,
  InsertUser,
  User,
  MediaItem,
  assistantMemories,
  emailLoginChallenges,
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
      "ALTER TYPE public.control_request_status ADD VALUE IF NOT EXISTS 'ready_for_review'",
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

/** Email login helpers. OTP values are never stored; only HMAC hashes are persisted. */
export async function createEmailLoginChallenge(input: {
  email: string;
  requestIpHash: string;
  codeHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.insert(emailLoginChallenges).values(input).returning();
  return rows[0];
}

export async function countRecentEmailLoginChallenges(
  email: string,
  requestIpHash: string,
  since: Date,
): Promise<{ emailCount: number; ipCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [emailRows, ipRows] = await Promise.all([
    db.select({ total: count() }).from(emailLoginChallenges).where(
      and(eq(emailLoginChallenges.email, email), gt(emailLoginChallenges.createdAt, since)),
    ),
    db.select({ total: count() }).from(emailLoginChallenges).where(
      and(eq(emailLoginChallenges.requestIpHash, requestIpHash), gt(emailLoginChallenges.createdAt, since)),
    ),
  ]);
  return {
    emailCount: Number(emailRows[0]?.total ?? 0),
    ipCount: Number(ipRows[0]?.total ?? 0),
  };
}

export async function getLatestEmailLoginChallenge(email: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select().from(emailLoginChallenges)
    .where(eq(emailLoginChallenges.email, email))
    .orderBy(desc(emailLoginChallenges.createdAt))
    .limit(1);
  return rows[0];
}

export async function incrementEmailLoginChallengeAttempts(id: number, maxAttempts: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.update(emailLoginChallenges)
    .set({ attempts: sql`${emailLoginChallenges.attempts} + 1` })
    .where(and(
      eq(emailLoginChallenges.id, id),
      isNull(emailLoginChallenges.consumedAt),
      lt(emailLoginChallenges.attempts, maxAttempts),
    ))
    .returning({ id: emailLoginChallenges.id });
  return rows.length === 1;
}

export async function consumeEmailLoginChallenge(id: number, now: Date, maxAttempts: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.update(emailLoginChallenges)
    .set({ consumedAt: now })
    .where(and(
      eq(emailLoginChallenges.id, id),
      isNull(emailLoginChallenges.consumedAt),
      gt(emailLoginChallenges.expiresAt, now),
      lt(emailLoginChallenges.attempts, maxAttempts),
    ))
    .returning({ id: emailLoginChallenges.id });
  return rows.length === 1;
}

export async function invalidateEmailLoginChallenge(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(emailLoginChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailLoginChallenges.id, id), isNull(emailLoginChallenges.consumedAt)));
}

export async function getUsersByNormalizedEmail(email: string): Promise<User[]> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(2);
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


/** Read private assistant memory for an authenticated account only. */
export async function getAssistantMemory(ownerOpenId: string): Promise<AssistantMemory | undefined> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select().from(assistantMemories)
    .where(eq(assistantMemories.ownerOpenId, ownerOpenId)).limit(1);
  return rows[0];
}

/** Explicit opt-in: creating or re-enabling memory always records consent time. */
export async function enableAssistantMemory(ownerOpenId: string): Promise<AssistantMemory> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const now = new Date();
  const rows = await db.insert(assistantMemories).values({
    ownerOpenId,
    enabled: true,
    consentedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: assistantMemories.ownerOpenId,
    targetWhere: sql`${assistantMemories.ownerOpenId} IS NOT NULL`,
    set: { enabled: true, consentedAt: now, updatedAt: now },
  }).returning();
  if (!rows[0]) throw new Error("تعذر تفعيل الذاكرة.");
  return rows[0];
}

/** Update only user-editable, non-sensitive memory fields. */
export async function updateAssistantMemory(
  ownerOpenId: string,
  input: Partial<Pick<AssistantMemory, "displayName" | "preferences" | "activeTopics" | "recentSummary">>,
): Promise<AssistantMemory | undefined> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.update(assistantMemories)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(assistantMemories.ownerOpenId, ownerOpenId))
    .returning();
  return rows[0];
}

/** Delete the account's complete assistant memory, including consent state. */
export async function deleteAssistantMemory(ownerOpenId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.delete(assistantMemories).where(eq(assistantMemories.ownerOpenId, ownerOpenId));
  return true;
}


export async function recordAssistantMemoryInteraction(ownerOpenId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.update(assistantMemories)
    .set({ lastInteractionAt: now, updatedAt: now })
    .where(eq(assistantMemories.ownerOpenId, ownerOpenId));
}


/** Pause memory without deleting the visitor's saved details. */
export async function disableAssistantMemory(ownerOpenId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(assistantMemories)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(assistantMemories.ownerOpenId, ownerOpenId));
  return true;
}
