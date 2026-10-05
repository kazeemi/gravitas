import app from "./app";
import { logger } from "./lib/logger";
import { startDeletionPurgeScheduler } from "./lib/deletion-purge";
import { startSessionWorker } from "./lib/sessionWorker";
import type { Worker } from "bullmq";
import { startQueueBacklogMonitor } from "./lib/queueMonitor";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

let sessionWorker: Worker | null = null;

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Recording processing (upload -> transcribe -> score) runs through this
  // queue worker rather than inline in the upload request, so a burst of
  // concurrent uploads gets processed a bounded number at a time instead of
  // all at once.
  sessionWorker = startSessionWorker();

  // Watches queue depth and emails an admin alert if the backlog gets large
  // enough to suggest processing is falling behind live demand.
  startQueueBacklogMonitor();

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

// ── Graceful shutdown ────────────────────────────────────────────────────────
// A deploy restarts the server. Uploaded audio sits on this instance's local
// disk until it has been analysed, and the next instance cannot see it — so a
// restart mid-analysis fails the recording. On SIGTERM we therefore stop taking
// new requests, let in-flight uploads finish, and wait for running analyses to
// complete before exiting.
//
// SHUTDOWN_TIMEOUT_MS must stay below the platform's own kill deadline (on
// Railway: RAILWAY_DEPLOYMENT_DRAINING_SECONDS), or the platform stops us first.
const SHUTDOWN_TIMEOUT_MS = Number(process.env["SHUTDOWN_TIMEOUT_MS"] ?? 120_000);
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal, timeoutMs: SHUTDOWN_TIMEOUT_MS }, "Shutdown requested — finishing in-progress work");

  const forceExit = setTimeout(() => {
    logger.error("Shutdown timed out — exiting with work still in progress");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    // 1. Stop accepting connections. In-flight requests (including uploads that
    //    are still arriving) are allowed to finish and enqueue their job; the
    //    worker is deliberately still running so it picks those jobs up.
    //    Keep-alive connections that go idle once their request completes would
    //    otherwise hold shutdown open for several seconds, so sweep them.
    await new Promise<void>(resolve => {
      const sweep = setInterval(() => server.closeIdleConnections(), 250);
      server.close(() => { clearInterval(sweep); resolve(); });
      server.closeIdleConnections();
    });
    // 2. Stop fetching new jobs and wait for the running analyses to finish.
    await sessionWorker?.close();
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT", () => { void shutdown("SIGINT"); });
