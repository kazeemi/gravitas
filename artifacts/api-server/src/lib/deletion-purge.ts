import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { usersTable } from "@workspace/db";
import { sendDeletionWarningEmail } from "./email.js";

const WARNING_AFTER_DAYS = 23;
const PURGE_AFTER_DAYS = 30;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Sends the day-23 "final warning" email to accounts that were soft-deleted
// 23+ days ago and have not already been warned.
async function sendPendingWarnings(): Promise<void> {
  const dueForWarning = await db
    .select()
    .from(usersTable)
    .where(
      and(
        isNotNull(usersTable.deletedAt),
        lte(usersTable.deletedAt, daysAgo(WARNING_AFTER_DAYS)),
        isNull(usersTable.deletionWarningSentAt),
      ),
    );

  for (const user of dueForWarning) {
    if (!user.accountRestoreToken) {
      logger.error({ userId: user.id }, "Deleted account missing restore token — skipping warning email");
      continue;
    }
    try {
      await sendDeletionWarningEmail(user.email, user.name ?? "there", user.accountRestoreToken);
      await db
        .update(usersTable)
        .set({ deletionWarningSentAt: new Date() })
        .where(eq(usersTable.id, user.id));
      logger.info({ userId: user.id }, "Sent 7-day final deletion warning email");
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to send final deletion warning email");
    }
  }
}

// Permanently deletes accounts that were soft-deleted 30+ days ago.
// `sessions.userId` cascades on delete, and `dimension_scores`,
// `session_ai_usage`, and `diagnostic_metrics` all cascade from `sessions`,
// so a single delete on the user row removes every dependent record.
async function purgeExpiredAccounts(): Promise<void> {
  const dueForPurge = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(and(isNotNull(usersTable.deletedAt), lte(usersTable.deletedAt, daysAgo(PURGE_AFTER_DAYS))));

  for (const user of dueForPurge) {
    try {
      await db.delete(usersTable).where(eq(usersTable.id, user.id));
      logger.info({ userId: user.id }, "Permanently purged account and all associated data past the 30-day retention window");
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to purge expired account");
    }
  }
}

export async function runDeletionPurge(): Promise<void> {
  await sendPendingWarnings();
  await purgeExpiredAccounts();
}

export function startDeletionPurgeScheduler(): void {
  runDeletionPurge().catch(err => logger.error({ err }, "Initial deletion purge run failed"));
  setInterval(() => {
    runDeletionPurge().catch(err => logger.error({ err }, "Scheduled deletion purge run failed"));
  }, CHECK_INTERVAL_MS);
}
