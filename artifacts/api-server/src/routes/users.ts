import { Router } from "express";
import { eq, inArray, isNull, and } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { usersTable, sessionsTable, dimensionScoresTable } from "@workspace/db";
import { sendDeletionConfirmationEmail, sendWelcomeEmail, scheduleNudgeEmail } from "../lib/email.js";

const router = Router();

router.get("/v1/users/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.user!.userId), isNull(usersTable.deletedAt))).limit(1);
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
    workEnvironment, workOrganisation, workCurrentRole, workCurrentRoleCustom, highStakesContexts,
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
  if (workOrganisation !== undefined) updates.workOrganisation = workOrganisation;
  if (workCurrentRole !== undefined) updates.workCurrentRole = workCurrentRole;
  if (workCurrentRoleCustom !== undefined) updates.workCurrentRoleCustom = workCurrentRoleCustom;
  if (highStakesContexts !== undefined) updates.highStakesContexts = highStakesContexts;
  const [user] = await db.update(usersTable).set(updates).where(and(eq(usersTable.id, req.user!.userId), isNull(usersTable.deletedAt))).returning();
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _ph, ...safe } = user;
  return res.json(safe);
});

router.post("/v1/users/me/onboarding", requireAuth, async (req, res) => {
  const {
    roleTitle, communicationContext, goal, defaultRecordingContext,
    interviewMode, interviewSector, interviewSectorCustom, interviewCompanies,
    careerStage, educationLevel, workExperienceYears,
    primaryGoal,
    interviewRole, interviewRoleCustom, interviewTimeline, interviewStage,
    interviewDate, hasConfirmedInterview,
    workEnvironment, workOrganisation, workCurrentRole, workCurrentRoleCustom, highStakesContexts,
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
    workOrganisation: workOrganisation ?? null,
    workCurrentRole: workCurrentRole ?? null,
    workCurrentRoleCustom: workCurrentRoleCustom ?? null,
    highStakesContexts: highStakesContexts ?? null,
    selfAssessmentThoughtClarity: typeof selfAssessmentThoughtClarity === "number" ? selfAssessmentThoughtClarity : null,
    selfAssessmentVocalDelivery: typeof selfAssessmentVocalDelivery === "number" ? selfAssessmentVocalDelivery : null,
    selfAssessmentVoiceQuality: typeof selfAssessmentVoiceQuality === "number" ? selfAssessmentVoiceQuality : null,
    selfAssessmentPhysicalDelivery: typeof selfAssessmentPhysicalDelivery === "number" ? selfAssessmentPhysicalDelivery : null,
    onboardingCompleted: true,
  }).where(and(eq(usersTable.id, req.user!.userId), isNull(usersTable.deletedAt))).returning();

  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    await sendWelcomeEmail(user.email, user.name ?? "there", user.interviewMode ?? false);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send welcome email after onboarding");
  }

  try {
    const nudgeEmailId = await scheduleNudgeEmail(user.email, user.name ?? "there", user.interviewMode ?? false);
    if (nudgeEmailId) {
      await db.update(usersTable).set({ nudgeEmailId }).where(eq(usersTable.id, user.id));
    }
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to schedule nudge email after onboarding");
  }

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
    scores = await db.select().from(dimensionScoresTable).where(inArray(dimensionScoresTable.sessionId, sessionIds));
  }
  const { passwordHash: _ph, ...safeUser } = user;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=export.json");
  return res.json({ user: safeUser, sessions, scores });
});

router.delete("/v1/users/me", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt))).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const restoreToken = crypto.randomBytes(32).toString("hex");
  await db.update(usersTable).set({ deletedAt: new Date(), accountRestoreToken: restoreToken }).where(eq(usersTable.id, userId));

  try {
    await sendDeletionConfirmationEmail(user.email, user.name ?? "there", restoreToken);
  } catch {
    // Non-fatal — deletion proceeds even if email fails
  }

  return res.json({ message: "Your account is scheduled for deletion. All data will be permanently erased within 30 days." });
});

router.post("/v1/users/me/consent", requireAuth, async (req, res) => {
  const { consentAccepted } = req.body;
  if (!consentAccepted) {
    return res.status(400).json({ error: "consentAccepted must be true" });
  }
  const CURRENT_PRIVACY_POLICY_VERSION = "1.0";
  const [user] = await db.update(usersTable)
    .set({ consentAcceptedAt: new Date(), privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION })
    .where(and(eq(usersTable.id, req.user!.userId), isNull(usersTable.deletedAt)))
    .returning();
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _ph, ...safe } = user;
  return res.json(safe);
});

export default router;
