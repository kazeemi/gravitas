import {
  pgTable,
  uuid,
  jsonb,
  decimal,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const diagnosticMetricsTable = pgTable("diagnostic_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }).unique(),
  fillerWordsJson: jsonb("filler_words_json"),
  wpmOverall: decimal("wpm_overall", { precision: 6, scale: 2 }),
  wpmByWindow: jsonb("wpm_by_window"),
  rushEvents: integer("rush_events"),
  strategicPauses: integer("strategic_pauses"),
  preStatementPauses: integer("pre_statement_pauses"),
  eyeContactRate: decimal("eye_contact_rate", { precision: 5, scale: 2 }),
  selfSootheEvents: integer("self_soothe_events"),
  selfSootheTypes: jsonb("self_soothe_types"),
  conciseness_flag: boolean("conciseness_flag"),
  breathSupportScore: decimal("breath_support_score", { precision: 4, scale: 3 }),
  audibleBreathEvents: integer("audible_breath_events"),
});

export const insertDiagnosticMetricSchema = createInsertSchema(diagnosticMetricsTable).omit({
  id: true,
});

export type InsertDiagnosticMetric = z.infer<typeof insertDiagnosticMetricSchema>;
export type DiagnosticMetric = typeof diagnosticMetricsTable.$inferSelect;
