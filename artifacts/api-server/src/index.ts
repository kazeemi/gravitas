import app from "./app";
import { logger } from "./lib/logger";

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

  // On startup, mark any sessions stuck in "processing" as "error".
  // These are orphaned by a previous server crash or SIGTERM mid-scoring.
  import("./lib/db.js").then(async ({ db }) => {
    const { sessionsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const stuck = await db
      .update(sessionsTable)
      .set({
        processingStatus: "error",
        processingError: "Something went wrong during analysis. Please record again.",
      })
      .where(eq(sessionsTable.processingStatus, "processing"))
      .returning({ id: sessionsTable.id });
    if (stuck.length > 0) {
      logger.warn({ count: stuck.length, ids: stuck.map(s => s.id) }, "Recovered stuck processing sessions on startup");
    }
  }).catch(e => logger.error({ err: e }, "Startup session recovery failed"));

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
