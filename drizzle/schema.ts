import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin", "secretary", "assistant", "it"]);
export const controlRequestStatus = pgEnum("control_request_status", [
  "pending",
  "reviewed",
  "in_progress",
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
  category: varchar("category", { length: 32 }).notNull().default("general"),
  priority: varchar("priority", { length: 16 }).notNull().default("normal"),
  assignee: varchar("assignee", { length: 32 }),
  decisionNote: text("decisionNote"),
  status: controlRequestStatus("status").default("pending").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ControlRequest = typeof controlRequests.$inferSelect;

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
