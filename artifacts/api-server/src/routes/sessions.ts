import { Router } from "express";
import multer from "multer";
import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { sessionsTable, dimensionScoresTable, usersTable } from "@workspace/db";
import { cancelScheduledEmail } from "../lib/email.js";
import { enqueueSessionProcessing } from "../lib/sessionQueue.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// Fallback allowance if a user row predates the per-user allowance column.
const DEFAULT_ALLOWANCE_SECONDS = 1800;

// Uploads stream straight to a temp file instead of memory — with many
// concurrent uploads, holding every file (up to 100MB each) in RAM at once
// risks the process running out of memory. The queue worker reads the file
// from disk and deletes it once feedback has been generated (see
// sessionWorker.ts) — we never keep raw recordings after that point.
const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, cb) => cb(null, `session-upload-${randomUUID()}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

router.post("/v1/sessions", requireAuth, async (req, res) => {
  const { mode, promptText, promptType, recordingContext } = req.body;
  if (!mode || !["audio", "video"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'audio' or 'video'" });
  }

  const [user] = await db.select({
    totalRecordingSeconds: usersTable.totalRecordingSeconds,
    recordingSecondsAllowance: usersTable.recordingSecondsAllowance,
    nudgeEmailId: usersTable.nudgeEmailId,
  })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  const allowanceSeconds = user?.recordingSecondsAllowance ?? DEFAULT_ALLOWANCE_SECONDS;

  if (user && user.totalRecordingSeconds >= allowanceSeconds) {
    return res.status(403).json({
      error: "recording_limit_reached",
      totalRecordingSeconds: user.totalRecordingSeconds,
      recordingSecondsAllowance: allowanceSeconds,
    });
  }

  if (user?.nudgeEmailId) {
    await cancelScheduledEmail(user.nudgeEmailId);
    await db.update(usersTable).set({ nudgeEmailId: null }).where(eq(usersTable.id, req.user!.userId));
  }

  const [session] = await db.insert(sessionsTable).values({
    userId: req.user!.userId,
    mode,
    promptText,
    promptType,
    recordingContext: recordingContext || "seated",
    processingStatus: "pending",
  }).returning();
  return res.status(201).json(session);
});

router.get("/v1/sessions", requireAuth, async (req, res) => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, req.user!.userId))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(50);
  return res.json({ sessions });
});

router.get("/v1/sessions/progress", requireAuth, async (req, res) => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, req.user!.userId), eq(sessionsTable.processingStatus, "complete")))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(20);
  return res.json({ sessions });
});

router.get("/v1/sessions/chart", requireAuth, async (req, res) => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, req.user!.userId), eq(sessionsTable.processingStatus, "complete")))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(50);

  if (sessions.length === 0) return res.json({ sessions: [] });

  const sessionIds = sessions.map(s => s.id);
  const allDimensions = await db
    .select()
    .from(dimensionScoresTable)
    .where(inArray(dimensionScoresTable.sessionId, sessionIds));

  const dimsBySession = new Map<string, Record<string, number>>();
  for (const dim of allDimensions) {
    if (!dimsBySession.has(dim.sessionId)) dimsBySession.set(dim.sessionId, {});
    dimsBySession.get(dim.sessionId)![dim.dimensionKey] = dim.score;
  }

  return res.json({
    sessions: sessions.map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      compositeScore: s.compositeScore,
      compositeTier: s.compositeTier,
      promptText: s.promptText,
      mode: s.mode,
      dimensions: dimsBySession.get(s.id) || {},
    })),
  });
});

router.get("/v1/sessions/:id", requireAuth, async (req, res) => {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, req.params.id), eq(sessionsTable.userId, req.user!.userId)))
    .limit(1);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const scores = await db
    .select()
    .from(dimensionScoresTable)
    .where(eq(dimensionScoresTable.sessionId, session.id));
  return res.json({ ...session, dimensionScores: scores });
});

router.delete("/v1/sessions/:id", requireAuth, async (req, res) => {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, req.params.id), eq(sessionsTable.userId, req.user!.userId)))
    .limit(1);
  if (!session) return res.status(404).json({ error: "Session not found" });
  await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
  return res.json({ message: "Session deleted" });
});

router.post(
  "/v1/sessions/:id/upload",
  requireAuth,
  upload.single("audio"),
  async (req, res) => {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.id, req.params.id), eq(sessionsTable.userId, req.user!.userId)))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.processingStatus === "processing") {
      return res.status(409).json({ error: "Session is already being processed" });
    }

    const durationSeconds = Number(req.body?.durationSeconds ?? 0);
    const audioGapEvents = Number(req.body?.audioGapEvents ?? 0);
    const faceLostEvents = Number(req.body?.faceLostEvents ?? 0);
    const silenceEvents = Number(req.body?.silenceEvents ?? 0);
    const audioFilePath: string | null = req.file?.path ?? null;

    if (durationSeconds < 60) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
      if (audioFilePath) await unlink(audioFilePath).catch(() => {});
      return res.status(400).json({
        error: `Recording too short — minimum 60 seconds required (got ${durationSeconds}s). Please record at least 1 minute.`,
      });
    }

    await db
      .update(sessionsTable)
      .set({ processingStatus: "processing" })
      .where(eq(sessionsTable.id, session.id));

    // Video frames (base64 strings) can be sizeable — write them to disk
    // rather than passing them through the job payload stored in Redis.
    let videoFramesFilePath: string | null = null;
    if (session.mode === "video" && req.body?.videoFrames) {
      videoFramesFilePath = join(tmpdir(), `session-frames-${randomUUID()}.json`);
      await writeFile(videoFramesFilePath, req.body.videoFrames as string);
    }

    try {
      await enqueueSessionProcessing({
        sessionId: session.id,
        audioFilePath,
        videoFramesFilePath,
        durationSeconds,
        audioGapEvents,
        faceLostEvents,
        silenceEvents,
      });
    } catch (err) {
      logger.error({ err, sessionId: session.id }, "failed to enqueue session for processing");
      await db
        .update(sessionsTable)
        .set({ processingStatus: "error", processingError: "Could not start processing. Please try again." })
        .where(eq(sessionsTable.id, session.id));
      if (audioFilePath) await unlink(audioFilePath).catch(() => {});
      if (videoFramesFilePath) await unlink(videoFramesFilePath).catch(() => {});
      return res.status(503).json({ error: "Could not start processing. Please try again." });
    }

    return res.status(202).json({ message: "Processing started" });
  }
);

router.post("/v1/sessions/:id/motivational-message", requireAuth, async (req, res) => {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, req.params.id), eq(sessionsTable.userId, req.user!.userId)))
    .limit(1);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.processingStatus !== "complete") return res.status(400).json({ error: "Session not complete" });

  let feedback: Record<string, unknown> = {};
  try { feedback = JSON.parse(session.overallFeedback ?? "{}"); } catch {}

  if (feedback.motivationalMessage) {
    return res.json({ message: feedback.motivationalMessage });
  }

  // Fetch completed session history for context
  const history = await db
    .select({ id: sessionsTable.id, compositeScore: sessionsTable.compositeScore, createdAt: sessionsTable.createdAt })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, req.user!.userId), eq(sessionsTable.processingStatus, "complete")))
    .orderBy(sessionsTable.createdAt);

  const sessionIndex = history.findIndex(s => s.id === session.id);
  const sessionNumber = sessionIndex >= 0 ? sessionIndex + 1 : 1;
  const prevSession = sessionIndex > 0 ? history[sessionIndex - 1] : null;
  const previousScore = prevSession?.compositeScore ? parseFloat(prevSession.compositeScore) : null;
  const currentScore = session.compositeScore ? parseFloat(session.compositeScore) : null;
  const delta = currentScore !== null && previousScore !== null ? currentScore - previousScore : null;

  const tier = session.compositeTier || "Developing";
  const summaryStrengths: string[] = Array.isArray(feedback.summaryStrengths) ? feedback.summaryStrengths as string[] : [];
  const summaryImprovements: string[] = Array.isArray(feedback.summaryImprovements) ? feedback.summaryImprovements as string[] : [];

  const deltaDescription = delta === null
    ? null
    : delta >= 1.0 ? "significant upward shift — their presence noticeably moved"
    : delta >= 0.5 ? "solid improvement — meaningful upward movement"
    : delta >= 0.1 ? "steady gain — held their level and edged forward"
    : delta >= -0.1 ? "held steady — consistent with last session"
    : "slight dip — common when experimenting with new techniques";

  const sessionContext = [
    sessionNumber === 1 ? "This is their first ever recording on the platform." : null,
    sessionNumber === 2 ? "This is the first time they have come back — a significant step most people skip." : null,
    deltaDescription ? `Score trend since last session: ${deltaDescription}.` : null,
    summaryStrengths.length > 0 ? `Strengths in this session: ${summaryStrengths.join("; ")}.` : null,
    summaryImprovements.length > 0 ? `Areas being worked on: ${summaryImprovements.join("; ")}.` : null,
    session.promptText ? `They were practicing: "${session.promptText}".` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are writing a short personal motivational note for someone who just completed session ${sessionNumber} on Gravitas, an AI executive presence coaching platform.

Context about this session:
${sessionContext}
Their overall presence tier: ${tier}

Write a short note (strictly under 50 words) as their warm, direct executive coach. Tone rules — match the tone to BOTH the tier AND the score trend together:
- "Congratulations!" and genuine excitement: ONLY if tier is Strong or Distinguished AND score moved up significantly. Do not celebrate if the tier is Developing or Needs Focus, even with improvement.
- Developing tier with improvement: encouraging and grounded — acknowledge the progress is real without overstating it.
- Developing or Needs Focus tier: realistic, focused on the direction, never hollow praise.
- First session: acknowledge it takes something to put yourself on camera.
- Second session: note that coming back is the part most people skip.
- Reference their actual strengths or improvement areas where relevant — keep it specific.
- Never mention numbers, scores, percentages, or tier names.
- No flowery language or excessive metaphors. Direct and human.
- Under 50 words. Output only the message text, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const message = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    if (!message) return res.status(500).json({ error: "Empty response from AI" });

    feedback.motivationalMessage = message;
    await db
      .update(sessionsTable)
      .set({ overallFeedback: JSON.stringify(feedback) })
      .where(eq(sessionsTable.id, session.id));

    return res.json({ message });
  } catch (err) {
    req.log.error({ err }, "Failed to generate motivational message");
    return res.status(500).json({ error: "Failed to generate message" });
  }
});

router.get("/v1/sessions/:id/status", requireAuth, async (req, res) => {
  const [session] = await db
    .select({
      id: sessionsTable.id,
      processingStatus: sessionsTable.processingStatus,
      processingError: sessionsTable.processingError,
      transcript: sessionsTable.transcript,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, req.params.id), eq(sessionsTable.userId, req.user!.userId)))
    .limit(1);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.setHeader("Cache-Control", "no-store");
  return res.json(session);
});

router.post("/v1/sessions/test-audio", requireAuth, (_req, res) => {
  res.json({
    quality: "good",
    level: 75,
    noiseLevel: "low",
    recommendation: "Audio quality is suitable for analysis.",
  });
});

router.post("/v1/sessions/test-video", requireAuth, (_req, res) => {
  res.json({
    quality: "good",
    faceDetected: true,
    lighting: "adequate",
    recommendation: "Video quality is suitable for analysis.",
  });
});

export default router;
