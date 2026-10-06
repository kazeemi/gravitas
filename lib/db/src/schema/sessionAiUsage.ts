import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

// Deliberately its own table rather than columns on `sessions` — the
// existing user-facing session routes do `select()` (all columns) and
// spread the row straight into the API response, so anything added to
// `sessions` would leak to the session's owner. Only admin routes query
// this table, so cost/usage data can never surface through a user-facing
// endpoint by accident.
export const sessionAiUsageTable = pgTable("session_ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  aiCall: varchar("ai_call", { length: 30 }).notNull(), // "transcription" | "audio_delivery" | "vision" | "scoring"
  model: varchar("model", { length: 60 }).notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const insertSessionAiUsageSchema = createInsertSchema(sessionAiUsageTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSessionAiUsage = z.infer<typeof insertSessionAiUsageSchema>;
export type SessionAiUsage = typeof sessionAiUsageTable.$inferSelect;
