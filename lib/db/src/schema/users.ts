import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  roleTitle: varchar("role_title", { length: 255 }),
  communicationContext: varchar("communication_context", { length: 100 }),
  goal: text("goal"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  methodologyVersion: varchar("methodology_version", { length: 10 }).notNull().default("3.0"),
  defaultRecordingContext: varchar("default_recording_context", { length: 20 }).default("seated"),
  emailSummaries: boolean("email_summaries").notNull().default(false),
  hasSeenWelcome: boolean("has_seen_welcome").notNull().default(false),
  totalRecordingSeconds: integer("total_recording_seconds").notNull().default(0),
  notifyOnUpgrade: boolean("notify_on_upgrade").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
