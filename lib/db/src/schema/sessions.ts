import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  mode: varchar("mode", { length: 10 }).notNull(),
  methodologyVersion: varchar("methodology_version", { length: 10 }).notNull().default("3.0"),
  promptText: text("prompt_text"),
  promptType: varchar("prompt_type", { length: 50 }),
  recordingContext: varchar("recording_context", { length: 20 }).default("seated"),
  durationSeconds: integer("duration_seconds"),
  transcript: text("transcript"),
  compositeScore: decimal("composite_score", { precision: 4, scale: 2 }),
  compositeTier: varchar("composite_tier", { length: 15 }),
  audioQualityFlag: boolean("audio_quality_flag").default(false),
  faceCoverageFlag: boolean("face_coverage_flag").default(false),
  audioGapEvents: integer("audio_gap_events").default(0),
  faceLostEvents: integer("face_lost_events").default(0),
  videoDownloaded: boolean("video_downloaded").default(false),
  silenceEvents: integer("silence_events").default(0),
  overallFeedback: text("overall_feedback"),
  processingStatus: varchar("processing_status", { length: 20 }).notNull().default("pending"),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  scoredAt: timestamp("scored_at", { withTimezone: true }),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
  scoredAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
