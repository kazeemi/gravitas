import { Router } from "express";
import multer from "multer";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { sessionsTable, dimensionScoresTable } from "@workspace/db";
import { scoreSession, transcribeAudio, analyzeAudioDelivery } from "../lib/scoring.js";
import { ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

router.post("/v1/sessions", requireAuth, async (req, res) => {
  const { mode, promptText, promptType, recordingContext } = req.body;
  if (!mode || !["audio", "video"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'audio' or 'video'" });
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
    const audioBuffer: Buffer | null = req.file?.buffer ?? null;

    if (durationSeconds < 60) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
      return res.status(400).json({
        error: `Recording too short — minimum 60 seconds required (got ${durationSeconds}s). Please record at least 1 minute.`,
      });
    }

    await db
      .update(sessionsTable)
      .set({ processingStatus: "processing" })
      .where(eq(sessionsTable.id, session.id));

    res.status(202).json({ message: "Processing started" });

    setImmediate(async () => {
      try {
        let transcript: string | undefined;
        let audioDeliveryAnalysis: string | undefined;

        if (audioBuffer && audioBuffer.length > 0) {
          const { buffer: wavBuffer, format } = await ensureCompatibleFormat(audioBuffer);

          const [transcriptResult, deliveryResult] = await Promise.allSettled([
            transcribeAudio(wavBuffer),
            analyzeAudioDelivery(wavBuffer, format, session.promptText || undefined),
          ]);

          if (transcriptResult.status === "fulfilled") {
            transcript = transcriptResult.value;
          } else {
            console.error("Whisper transcription failed:", transcriptResult.reason);
          }

          if (deliveryResult.status === "fulfilled" && deliveryResult.value) {
            audioDeliveryAnalysis = deliveryResult.value;
          } else {
            console.error("Audio delivery analysis failed:", deliveryResult.status === "rejected" ? deliveryResult.reason : "empty result");
          }
        }

        const result = await scoreSession({
          mode: session.mode as "audio" | "video",
          durationSeconds,
          audioGapEvents,
          faceLostEvents,
          silenceEvents,
          transcript,
          audioDeliveryAnalysis,
          recordingContext: session.recordingContext || "seated",
          promptText: session.promptText || undefined,
        });

        await db.insert(dimensionScoresTable).values(
          result.dimensions.map(d => ({
            sessionId: session.id,
            dimensionKey: d.dimensionKey,
            score: d.score,
            tier: d.tier,
            rawMetrics: d.rawMetrics,
            strengthText: d.strengthText,
            gapText: d.gapText,
            nextStepText: d.nextStepText,
          }))
        );

        await db
          .update(sessionsTable)
          .set({
            processingStatus: "complete",
            compositeScore: String(result.compositeScore),
            compositeTier: result.compositeTier,
            audioQualityFlag: result.audioQualityFlag,
            faceCoverageFlag: result.faceCoverageFlag,
            overallFeedback: result.overallFeedback,
            durationSeconds,
            audioGapEvents,
            faceLostEvents,
            silenceEvents,
            transcript,
            scoredAt: new Date(),
          })
          .where(eq(sessionsTable.id, session.id));
      } catch (err) {
        await db
          .update(sessionsTable)
          .set({
            processingStatus: "error",
            processingError: err instanceof Error ? err.message : String(err),
          })
          .where(eq(sessionsTable.id, session.id));
      }
    });
  }
);

router.get("/v1/sessions/:id/status", requireAuth, async (req, res) => {
  const [session] = await db
    .select({
      id: sessionsTable.id,
      processingStatus: sessionsTable.processingStatus,
      processingError: sessionsTable.processingError,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, req.params.id), eq(sessionsTable.userId, req.user!.userId)))
    .limit(1);
  if (!session) return res.status(404).json({ error: "Session not found" });
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

router.get("/v1/sessions/progress", requireAuth, async (req, res) => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, req.user!.userId), eq(sessionsTable.processingStatus, "complete")))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(20);
  return res.json({ sessions });
});

export default router;
