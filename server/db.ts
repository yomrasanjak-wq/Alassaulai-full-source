import { count, desc, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  ControlRequest,
  GuestMemory,
  InsertUser,
  MediaItem,
  controlRequests,
  guestMemories,
  mediaItems,
  users,
} from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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

export async function countRegisteredVisitors(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count() }).from(users);
  return Number(result[0]?.total ?? 0);
}

export async function createControlRequest(
  input: Pick<ControlRequest, "title" | "command" | "requesterType" | "category" | "priority">,
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
