import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const dimensionScoresTable = pgTable("dimension_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  dimensionKey: varchar("dimension_key", { length: 50 }).notNull(),
  score: integer("score").notNull(),
  tier: varchar("tier", { length: 15 }).notNull(),
  rawMetrics: jsonb("raw_metrics"),
  strengthText: text("strength_text"),
  gapText: text("gap_text"),
  nextStepText: text("next_step_text"),
});

export const insertDimensionScoreSchema = createInsertSchema(dimensionScoresTable).omit({
  id: true,
});

export type InsertDimensionScore = z.infer<typeof insertDimensionScoreSchema>;
export type DimensionScore = typeof dimensionScoresTable.$inferSelect;
