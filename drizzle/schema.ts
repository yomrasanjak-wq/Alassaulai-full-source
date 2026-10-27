import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const controlRequests = mysqlTable("controlRequests", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull().default("طلب جديد"),
  command: text("command").notNull(),
  requesterType: varchar("requesterType", { length: 32 }).notNull().default("visitor"),
  category: varchar("category", { length: 32 }).notNull().default("general"),
  priority: varchar("priority", { length: 16 }).notNull().default("normal"),
  assignee: varchar("assignee", { length: 32 }),
  decisionNote: text("decisionNote"),
  status: mysqlEnum("status", ["pending", "reviewed", "in_progress", "completed", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mediaItems = mysqlTable("mediaItems", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("entertainment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guestMemories = mysqlTable("guestMemories", {
  id: int("id").autoincrement().primaryKey(),
  imageUrl: text("imageUrl"),
  caption: text("caption"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ControlRequest = typeof controlRequests.$inferSelect;
export type MediaItem = typeof mediaItems.$inferSelect;
export type GuestMemory = typeof guestMemories.$inferSelect;
