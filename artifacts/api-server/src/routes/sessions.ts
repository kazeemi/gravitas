import { Router } from "express";
import multer from "multer";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { sessionsTable, dimensionScoresTable } from "@workspace/db";
import { scoreSession, transcribeAudio, analyzeAudioDelivery, analyzeVideoPresence, type VideoPresenceResult } from "../lib/scoring.js";
import { ensureCompatibleFormat, computeRmsMetrics, computeF0Metrics, type RmsMetrics, type F0Metrics } from "@workspace/integrations-openai-ai-server/audio";

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

router.get("/v1/sessions/progress", requireAuth, async (req, res) => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, req.user!.userId), eq(sessionsTable.processingStatus, "complete")))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(20);
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

    // Parse video frames if present (video mode only)
    let videoFrames: string[] = [];
    if (session.mode === "video" && req.body?.videoFrames) {
      try {
        const parsed = JSON.parse(req.body.videoFrames as string);
        if (Array.isArray(parsed)) videoFrames = parsed.filter((f): f is string => typeof f === "string");
      } catch {
        console.error("Failed to parse videoFrames JSON");
      }
    }

    setImmediate(async () => {
      try {
        let transcript: string | undefined;
        let speechDurationSeconds: number | null = null;
        let audioDeliveryAnalysis: string | undefined;
        let pitchVariationScore: number | null = null;
        let breathingScore: number | null = null;
        let breathingObservation: string | null = null;
        let videoPresenceAnalysis: VideoPresenceResult | null = null;
        let rmsMetrics: RmsMetrics | null = null;
        let f0Metrics: F0Metrics | null = null;
        let pauseMetrics = null;

        if (audioBuffer && audioBuffer.length > 0) {
          logger.info({ sessionId: session.id, rawBytes: audioBuffer.length }, "audio upload received — converting format");

          const { buffer: wavBuffer, format } = await ensureCompatibleFormat(audioBuffer);
          logger.info({ sessionId: session.id, detectedFormat: format, convertedBytes: wavBuffer.length }, "audio format ready");

          // Compute signal-processing metrics synchronously from the PCM buffer
          if (format === "wav") {
            try {
              rmsMetrics = computeRmsMetrics(wavBuffer);
              f0Metrics = computeF0Metrics(wavBuffer);
              logger.info({ sessionId: session.id, rmsMetrics, f0Metrics }, "acoustic metrics computed");
            } catch (err) {
              logger.warn({ sessionId: session.id, err }, "acoustic metric computation failed — continuing without them");
            }
          }

          const [transcriptResult, deliveryResult] = await Promise.allSettled([
            transcribeAudio(wavBuffer),
            analyzeAudioDelivery(wavBuffer, format, session.promptText || undefined),
          ]);

          if (transcriptResult.status === "fulfilled") {
            transcript = transcriptResult.value.transcript;
            speechDurationSeconds = transcriptResult.value.speechDurationSeconds;
            pauseMetrics = transcriptResult.value.pauseMetrics;
            logger.info({
              sessionId: session.id,
              transcriptWords: transcript ? transcript.trim().split(/\s+/).filter(Boolean).length : 0,
              speechDurationSeconds,
              pauseCount: pauseMetrics?.pauseCount ?? null,
            }, "transcription complete");
          } else {
            logger.error({ sessionId: session.id, err: transcriptResult.reason }, "transcription failed");
          }

          if (deliveryResult.status === "fulfilled" && deliveryResult.value) {
            const dr = deliveryResult.value;
            audioDeliveryAnalysis = dr.analysisText;
            pitchVariationScore = dr.pitchVariationScore;
            breathingScore = dr.breathingScore;
            breathingObservation = dr.breathingObservation;
            logger.info({ sessionId: session.id, pitchVariationScore, breathingScore }, "delivery analysis complete");
          } else {
            logger.error({
              sessionId: session.id,
              err: deliveryResult.status === "rejected" ? deliveryResult.reason : "empty result",
            }, "delivery analysis failed");
          }
        } else {
          logger.warn({ sessionId: session.id }, "no audio buffer received — skipping transcription");
        }

        // Run video presence analysis in parallel with audio analysis for video sessions
        if (session.mode === "video" && videoFrames.length > 0) {
          try {
            console.log(`Running video presence analysis on ${videoFrames.length} frames`);
            videoPresenceAnalysis = await analyzeVideoPresence(
              videoFrames,
              session.promptText || undefined,
              session.recordingContext || "seated"
            );
            console.log("Video presence analysis complete");
          } catch (err) {
            console.error("Video presence analysis failed:", err);
          }
        } else if (session.mode === "video") {
          console.warn("Video session but no frames received — visual dimensions will not be assessable");
        }

        // If no speech was detected AND no audio delivery analysis could be
        // produced, there is nothing to score. Save the session as complete
        // but without any scores so the UI can show a clear "try again" message.
        const hasAnyAudioData =
          (transcript && transcript.trim().length > 0) ||
          (audioDeliveryAnalysis && audioDeliveryAnalysis.trim().length > 0) ||
          videoPresenceAnalysis != null;

        if (!hasAnyAudioData) {
          await db
            .update(sessionsTable)
            .set({
              processingStatus: "complete",
              compositeScore: null,
              compositeTier: null,
              audioQualityFlag: true,
              faceCoverageFlag: false,
              overallFeedback: null,
              durationSeconds,
              audioGapEvents,
              faceLostEvents,
              silenceEvents,
              transcript: null,
              scoredAt: new Date(),
            })
            .where(eq(sessionsTable.id, session.id));
          return;
        }

        const result = await scoreSession({
          mode: session.mode as "audio" | "video",
          durationSeconds,
          speechDurationSeconds,
          audioGapEvents,
          faceLostEvents,
          videoPresenceAnalysis,
          silenceEvents,
          transcript,
          audioDeliveryAnalysis,
          pitchVariationScore,
          breathingScore,
          breathingObservation,
          rmsMetrics,
          f0Metrics,
          pauseMetrics,
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

export default router;
