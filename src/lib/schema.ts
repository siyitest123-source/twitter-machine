import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const voiceSamples = sqliteTable("voice_samples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  context: text("context"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const targetAccounts = sqliteTable("target_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull().unique(),
  notes: text("notes"),
  engagementMode: text("engagement_mode", {
    enum: ["engage", "monitor", "amplify"],
  })
    .notNull()
    .default("engage"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["reply", "qrt", "original", "thread"] }).notNull(),
  text: text("text").notNull(),
  threadParts: text("thread_parts"), // JSON string[] for thread continuation tweets
  sourceUrl: text("source_url"),
  sourceText: text("source_text"),
  sourceHandle: text("source_handle"),
  angle: text("angle"),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "posted"],
  })
    .notNull()
    .default("pending"),
  scheduledFor: integer("scheduled_for"),
  postedAt: integer("posted_at"),
  impressions: integer("impressions").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  retweets: integer("retweets").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  metricsUpdatedAt: integer("metrics_updated_at"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export type VoiceSample = typeof voiceSamples.$inferSelect;
export type TargetAccount = typeof targetAccounts.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
