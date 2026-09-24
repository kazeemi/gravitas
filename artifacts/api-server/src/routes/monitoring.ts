import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/auth.js";
import { sessionQueue } from "../lib/sessionQueue.js";

const router: IRouter = Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Live view of the recording-processing queue — waiting/active means work
// still in flight, failed means jobs that exhausted retries (also alerted by
// email, see queueMonitor.ts). Intended for a dashboard someone watches
// during a high-load event, not for end users.
router.get("/v1/admin/queue-stats", requireAdmin, async (_req, res) => {
  const counts = await sessionQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
  res.json(counts);
});

export default router;
