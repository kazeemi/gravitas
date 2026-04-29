import { Router } from "express";
import { eq, desc, count, avg, sum, isNotNull, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";
import { usersTable, sessionsTable, dimensionScoresTable } from "@workspace/db";

const router = Router();

// Admin data must always be fresh — disable HTTP caching for all admin routes
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/v1/admin/stats", requireAdmin, async (_req, res) => {
  const [userCount] = await db.select({ count: count() }).from(usersTable).where(isNotNull(usersTable.id));
  const [sessionCount] = await db.select({ count: count() }).from(sessionsTable);
  const [completedCount] = await db
    .select({ count: count() })
    .from(sessionsTable)
    .where(eq(sessionsTable.processingStatus, "complete"));
  const [avgScoreRow] = await db
    .select({ avg: avg(sessionsTable.compositeScore) })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.processingStatus, "complete"), isNotNull(sessionsTable.compositeScore)));
  const [totalSecondsRow] = await db
    .select({ total: sum(sessionsTable.durationSeconds) })
    .from(sessionsTable)
    .where(eq(sessionsTable.processingStatus, "complete"));
  const [audioCount] = await db
    .select({ count: count() })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.mode, "audio"), eq(sessionsTable.processingStatus, "complete")));
  const [videoCount] = await db
    .select({ count: count() })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.mode, "video"), eq(sessionsTable.processingStatus, "complete")));

  return res.json({
    totalUsers: Number(userCount?.count ?? 0),
    totalSessions: Number(sessionCount?.count ?? 0),
    completedSessions: Number(completedCount?.count ?? 0),
    avgCompositeScore: avgScoreRow?.avg ? Number(Number(avgScoreRow.avg).toFixed(2)) : null,
    totalRecordingSeconds: Number(totalSecondsRow?.total ?? 0),
    audioSessions: Number(audioCount?.count ?? 0),
    videoSessions: Number(videoCount?.count ?? 0),
  });
});

router.get("/v1/admin/users", requireAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      roleTitle: usersTable.roleTitle,
      communicationContext: usersTable.communicationContext,
      onboardingCompleted: usersTable.onboardingCompleted,
      totalRecordingSeconds: usersTable.totalRecordingSeconds,
      notifyOnUpgrade: usersTable.notifyOnUpgrade,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const sessionCounts = await db
    .select({ userId: sessionsTable.userId, count: count(), avgScore: avg(sessionsTable.compositeScore) })
    .from(sessionsTable)
    .where(eq(sessionsTable.processingStatus, "complete"))
    .groupBy(sessionsTable.userId);

  const countMap = new Map(sessionCounts.map(r => [r.userId, { count: Number(r.count), avgScore: r.avgScore ? Number(Number(r.avgScore).toFixed(2)) : null }]));

  return res.json({
    users: users.map(u => ({
      ...u,
      completedSessions: countMap.get(u.id)?.count ?? 0,
      avgScore: countMap.get(u.id)?.avgScore ?? null,
    })),
  });
});

router.get("/v1/admin/users/:id", requireAdmin, async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      roleTitle: usersTable.roleTitle,
      communicationContext: usersTable.communicationContext,
      goal: usersTable.goal,
      onboardingCompleted: usersTable.onboardingCompleted,
      totalRecordingSeconds: usersTable.totalRecordingSeconds,
      notifyOnUpgrade: usersTable.notifyOnUpgrade,
      isAdmin: usersTable.isAdmin,
      defaultRecordingContext: usersTable.defaultRecordingContext,
      emailSummaries: usersTable.emailSummaries,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.params.id))
    .limit(1);

  if (!user) return res.status(404).json({ error: "User not found" });

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, req.params.id))
    .orderBy(desc(sessionsTable.createdAt));

  return res.json({ user, sessions });
});

router.get("/v1/admin/sessions/:id", requireAdmin, async (req, res) => {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, req.params.id))
    .limit(1);

  if (!session) return res.status(404).json({ error: "Session not found" });

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  const scores = await db
    .select()
    .from(dimensionScoresTable)
    .where(eq(dimensionScoresTable.sessionId, session.id));

  return res.json({ session, user, dimensionScores: scores });
});

router.patch("/v1/admin/users/:id", requireAdmin, async (req, res) => {
  const { isAdmin } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;
  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.params.id))
    .returning({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
});

export default router;
