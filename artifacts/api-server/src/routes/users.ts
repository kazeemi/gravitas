import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { usersTable, sessionsTable, dimensionScoresTable } from "@workspace/db";

const router = Router();

router.get("/v1/users/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _ph, ...safe } = user;
  return res.json(safe);
});

router.patch("/v1/users/me", requireAuth, async (req, res) => {
  const { name, roleTitle, communicationContext, goal, defaultRecordingContext, emailSummaries } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (roleTitle !== undefined) updates.roleTitle = roleTitle;
  if (communicationContext !== undefined) updates.communicationContext = communicationContext;
  if (goal !== undefined) updates.goal = goal;
  if (defaultRecordingContext !== undefined) updates.defaultRecordingContext = defaultRecordingContext;
  if (emailSummaries !== undefined) updates.emailSummaries = emailSummaries;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.userId)).returning();
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _ph, ...safe } = user;
  return res.json(safe);
});

router.post("/v1/users/me/onboarding", requireAuth, async (req, res) => {
  const { roleTitle, communicationContext, goal, defaultRecordingContext } = req.body;
  const [user] = await db.update(usersTable).set({
    roleTitle,
    communicationContext,
    goal,
    defaultRecordingContext,
    onboardingCompleted: true,
  }).where(eq(usersTable.id, req.user!.userId)).returning();
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _ph, ...safe } = user;
  return res.json(safe);
});

router.get("/v1/users/me/export", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, req.user!.userId));
  const sessionIds = sessions.map(s => s.id);
  let scores: (typeof dimensionScoresTable.$inferSelect)[] = [];
  if (sessionIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    scores = await db.select().from(dimensionScoresTable).where(inArray(dimensionScoresTable.sessionId, sessionIds));
  }
  const { passwordHash: _ph, ...safeUser } = user;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=export.json");
  return res.json({ user: safeUser, sessions, scores });
});

export default router;
