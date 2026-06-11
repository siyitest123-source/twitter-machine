import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  persona: text("persona"), // short description of this account's role/voice/tone
  typefullyApiKey: text("typefully_api_key"), // per-account, used by /api/drafts/[id]/typefully
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const voiceSamples = sqliteTable("voice_samples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  text: text("text").notNull(),
  context: text("context"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const targetAccounts = sqliteTable(
  "target_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id").notNull(),
    handle: text("handle").notNull(),
    notes: text("notes"),
    engagementMode: text("engagement_mode", {
      enum: ["engage", "monitor", "amplify"],
    })
      .notNull()
      .default("engage"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [unique().on(t.accountId, t.handle)],
);

export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
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
  imageUrl: text("image_url"), // /api/image/<accountId>/<draftId>.jpg when generated
  imagePrompt: text("image_prompt"), // the Flux prompt we sent — for debugging + regen
  typefullyDraftId: text("typefully_draft_id"),
  typefullyUrl: text("typefully_url"),
  typefullySentAt: integer("typefully_sent_at"),
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

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type VoiceSample = typeof voiceSamples.$inferSelect;
export type TargetAccount = typeof targetAccounts.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
