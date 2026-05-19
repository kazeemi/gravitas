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
  const {
    name, roleTitle, communicationContext, goal, defaultRecordingContext,
    emailSummaries, hasSeenWelcome, notifyOnUpgrade,
    interviewMode, interviewSector, interviewSectorCustom, interviewCompanies,
    educationLevel, workExperienceYears, primaryGoal,
    interviewRole, interviewTimeline, interviewDate, hasConfirmedInterview,
    workEnvironment, workCurrentRole, workCurrentRoleCustom, highStakesContexts,
  } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (roleTitle !== undefined) updates.roleTitle = roleTitle;
  if (communicationContext !== undefined) updates.communicationContext = communicationContext;
  if (goal !== undefined) updates.goal = goal;
  if (defaultRecordingContext !== undefined) updates.defaultRecordingContext = defaultRecordingContext;
  if (emailSummaries !== undefined) updates.emailSummaries = emailSummaries;
  if (hasSeenWelcome !== undefined) updates.hasSeenWelcome = hasSeenWelcome;
  if (notifyOnUpgrade !== undefined) updates.notifyOnUpgrade = notifyOnUpgrade;
  if (interviewMode !== undefined) updates.interviewMode = interviewMode;
  if (interviewSector !== undefined) updates.interviewSector = interviewSector;
  if (interviewSectorCustom !== undefined) updates.interviewSectorCustom = interviewSectorCustom;
  if (interviewCompanies !== undefined) updates.interviewCompanies = interviewCompanies;
  if (educationLevel !== undefined) updates.educationLevel = educationLevel;
  if (workExperienceYears !== undefined) updates.workExperienceYears = workExperienceYears;
  if (primaryGoal !== undefined) updates.primaryGoal = primaryGoal;
  if (interviewRole !== undefined) updates.interviewRole = interviewRole;
  if (interviewTimeline !== undefined) updates.interviewTimeline = interviewTimeline;
  if (interviewDate !== undefined) updates.interviewDate = interviewDate;
  if (hasConfirmedInterview !== undefined) updates.hasConfirmedInterview = hasConfirmedInterview;
  if (workEnvironment !== undefined) updates.workEnvironment = workEnvironment;
  if (workCurrentRole !== undefined) updates.workCurrentRole = workCurrentRole;
  if (workCurrentRoleCustom !== undefined) updates.workCurrentRoleCustom = workCurrentRoleCustom;
  if (highStakesContexts !== undefined) updates.highStakesContexts = highStakesContexts;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.userId)).returning();
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _ph, ...safe } = user;
  return res.json(safe);
});

router.post("/v1/users/me/onboarding", requireAuth, async (req, res) => {
  const {
    // legacy + common
    roleTitle, communicationContext, goal, defaultRecordingContext,
    interviewMode, interviewSector, interviewSectorCustom, interviewCompanies,
    // v2 professional profile
    careerStage, educationLevel, workExperienceYears,
    // v2 primary goal path
    primaryGoal,
    // v2 interview path
    interviewRole, interviewRoleCustom, interviewTimeline, interviewStage,
    interviewDate, hasConfirmedInterview,
    // v2 workplace path
    workEnvironment, workCurrentRole, workCurrentRoleCustom, highStakesContexts,
    // v2 self-assessment
    selfAssessmentThoughtClarity, selfAssessmentVocalDelivery,
    selfAssessmentVoiceQuality, selfAssessmentPhysicalDelivery,
  } = req.body;

  const [user] = await db.update(usersTable).set({
    roleTitle: roleTitle ?? null,
    communicationContext: communicationContext ?? null,
    goal: goal ?? null,
    defaultRecordingContext: defaultRecordingContext ?? null,
    interviewMode: typeof interviewMode === "boolean" ? interviewMode : primaryGoal === "interview_prep",
    interviewSector: interviewSector ?? null,
    interviewSectorCustom: interviewSectorCustom ?? null,
    interviewCompanies: interviewCompanies ?? null,
    // v2 fields
    careerStage: careerStage ?? null,
    educationLevel: educationLevel ?? null,
    workExperienceYears: workExperienceYears ?? null,
    primaryGoal: primaryGoal ?? null,
    interviewRole: interviewRole ?? null,
    interviewRoleCustom: interviewRoleCustom ?? null,
    interviewTimeline: interviewTimeline ?? null,
    interviewStage: interviewStage ?? null,
    interviewDate: interviewDate ?? null,
    hasConfirmedInterview: typeof hasConfirmedInterview === "boolean" ? hasConfirmedInterview : null,
    workEnvironment: workEnvironment ?? null,
    workCurrentRole: workCurrentRole ?? null,
    workCurrentRoleCustom: workCurrentRoleCustom ?? null,
    highStakesContexts: highStakesContexts ?? null,
    selfAssessmentThoughtClarity: typeof selfAssessmentThoughtClarity === "number" ? selfAssessmentThoughtClarity : null,
    selfAssessmentVocalDelivery: typeof selfAssessmentVocalDelivery === "number" ? selfAssessmentVocalDelivery : null,
    selfAssessmentVoiceQuality: typeof selfAssessmentVoiceQuality === "number" ? selfAssessmentVoiceQuality : null,
    selfAssessmentPhysicalDelivery: typeof selfAssessmentPhysicalDelivery === "number" ? selfAssessmentPhysicalDelivery : null,
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
