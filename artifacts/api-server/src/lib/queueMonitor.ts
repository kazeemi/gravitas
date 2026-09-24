import { logger } from "./logger.js";
import { sessionQueue } from "./sessionQueue.js";
import { notifyAdminQueueBacklog } from "./email.js";

const CHECK_INTERVAL_MS = 60 * 1000; // every minute
const BACKLOG_ALERT_THRESHOLD = Number(process.env.QUEUE_BACKLOG_ALERT_THRESHOLD ?? 30);
// Don't re-alert every minute while the backlog stays high — that's noise
// during exactly the moment someone should be looking at the dashboard, not
// their inbox. Re-alert at most this often.
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

let lastAlertAt = 0;

async function checkBacklog(): Promise<void> {
  const counts = await sessionQueue.getJobCounts("waiting", "active");
  const backlog = (counts.waiting ?? 0) + (counts.active ?? 0);
  logger.info({ waiting: counts.waiting, active: counts.active }, "queue backlog check");

  if (backlog >= BACKLOG_ALERT_THRESHOLD && Date.now() - lastAlertAt > ALERT_COOLDOWN_MS) {
    lastAlertAt = Date.now();
    logger.warn({ waiting: counts.waiting, active: counts.active }, "queue backlog crossed alert threshold");
    await notifyAdminQueueBacklog(counts.waiting ?? 0, counts.active ?? 0);
  }
}

export function startQueueBacklogMonitor(): void {
  setInterval(() => {
    checkBacklog().catch(err => logger.error({ err }, "queue backlog check failed"));
  }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS, threshold: BACKLOG_ALERT_THRESHOLD }, "queue backlog monitor started");
}
