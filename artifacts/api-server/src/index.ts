import app from "./app";
import { logger } from "./lib/logger";
import { startDeletionPurgeScheduler } from "./lib/deletion-purge";
import { startSessionWorker } from "./lib/sessionWorker";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Recording processing (upload -> transcribe -> score) runs through this
  // queue worker rather than inline in the upload request, so a burst of
  // concurrent uploads gets processed a bounded number at a time instead of
  // all at once.
  startSessionWorker();

  // GDPR Art. 17 erasure: warns accounts 23 days after deletion request,
  // then permanently purges them (and all cascaded data) at day 30.
  startDeletionPurgeScheduler();

  // Sessions in "processing" now correspond to a durable job sitting in the
  // Redis queue (see sessionQueue.ts / sessionWorker.ts), which survives a
  // server restart and gets picked back up automatically — unlike the old
  // in-process setImmediate pipeline, they are no longer orphaned on crash,
  // so there is nothing to sweep here.

  // One-time admin account bootstrap: if ADMIN_SETUP_EMAIL is set,
  // grant is_admin=true and set the password for that account.
  // Remove ADMIN_SETUP_EMAIL from env after first successful deploy.
  const setupEmail = process.env["ADMIN_SETUP_EMAIL"];
  const setupPassword = process.env["ADMIN_SETUP_PASSWORD"];
  if (setupEmail && setupPassword) {
    import("bcryptjs").then(async ({ default: bcrypt }) => {
      const { db } = await import("./lib/db.js");
      const { usersTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const hash = await bcrypt.hash(setupPassword, 12);
      const updated = await db
        .update(usersTable)
        .set({ isAdmin: true, passwordHash: hash })
        .where(eq(usersTable.email, setupEmail.toLowerCase()))
        .returning({ id: usersTable.id, email: usersTable.email });
      if (updated.length > 0) {
        logger.info({ email: updated[0]?.email }, "Admin account bootstrapped");
      } else {
        logger.warn({ email: setupEmail }, "Admin bootstrap: user not found");
      }
    }).catch(e => logger.error({ err: e }, "Admin bootstrap failed"));
  }
});
