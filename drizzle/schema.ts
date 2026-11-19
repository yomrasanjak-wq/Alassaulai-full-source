import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin", "secretary", "assistant", "it", "partner", "executor"]);
export const controlRequestStatus = pgEnum("control_request_status", [
  "pending",
  "reviewed",
  "in_progress",
  "ready_for_review",
  "completed",
  "rejected",
]);

const createdAt = () => timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull();
const updatedAt = () => timestamp("updatedAt", { withTimezone: true, mode: "date" }).defaultNow().notNull();

/** Core user table backing the Manus OAuth flow. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const controlRequests = pgTable("controlRequests", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull().default("طلب جديد"),
  command: text("command").notNull(),
  requesterType: varchar("requesterType", { length: 32 }).notNull().default("visitor"),
  requesterOpenId: varchar("requesterOpenId", { length: 64 }),
  category: varchar("category", { length: 32 }).notNull().default("general"),
  priority: varchar("priority", { length: 16 }).notNull().default("normal"),
  assignee: varchar("assignee", { length: 32 }),
  decisionNote: text("decisionNote"),
  status: controlRequestStatus("status").default("pending").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ControlRequest = typeof controlRequests.$inferSelect;

export const controlAuditLogs = pgTable("controlAuditLogs", {
  id: serial("id").primaryKey(),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  targetType: varchar("targetType", { length: 40 }).notNull(),
  targetId: varchar("targetId", { length: 80 }),
  details: text("details"),
  createdAt: createdAt(),
});

export type ControlAuditLog = typeof controlAuditLogs.$inferSelect;

export const mediaItems = pgTable("mediaItems", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("entertainment"),
  createdAt: createdAt(),
});

export type MediaItem = typeof mediaItems.$inferSelect;

export const guestMemories = pgTable("guestMemories", {
  id: serial("id").primaryKey(),
  imageUrl: text("imageUrl"),
  caption: text("caption"),
  createdAt: createdAt(),
});

export type GuestMemory = typeof guestMemories.$inferSelect;


/**
 * Private assistant memory. Exactly one owner identity is set per row:
 * authenticated openId OR a server-issued anonymous subject hash.
 * Raw anonymous identifiers are never stored.
 */
export const assistantMemories = pgTable("assistantMemories", {
  id: serial("id").primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }),
  visitorSubjectHash: varchar("visitorSubjectHash", { length: 64 }),
  consentedAt: timestamp("consentedAt", { withTimezone: true, mode: "date" }),
  enabled: boolean("enabled").notNull().default(false),
  displayName: varchar("displayName", { length: 80 }),
  preferences: jsonb("preferences").$type<string[]>().notNull().default([]),
  activeTopics: jsonb("activeTopics").$type<string[]>().notNull().default([]),
  recentSummary: text("recentSummary"),
  lastInteractionAt: timestamp("lastInteractionAt", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type AssistantMemory = typeof assistantMemories.$inferSelect;
