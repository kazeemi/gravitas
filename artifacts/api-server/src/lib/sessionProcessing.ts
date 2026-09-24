import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { sessionsTable, dimensionScoresTable, usersTable } from "@workspace/db";
import { scoreSession, transcribeAudio, analyzeAudioDelivery, analyzeVideoPresence, type VideoPresenceResult } from "./scoring.js";
import { ensureCompatibleFormat, computeRmsMetrics, computeF0Metrics, type RmsMetrics, type F0Metrics } from "@workspace/integrations-openai-ai-server/audio";
import { getPromptContext, getPromptStructureFamily } from "../routes/prompts.js";
import { notifyAdminSessionScored } from "./email.js";

export type SessionRecordingInput = {
  sessionId: string;
  audioBuffer: Buffer | null;
  videoFrames: string[];
  durationSeconds: number;
  audioGapEvents: number;
  faceLostEvents: number;
  silenceEvents: number;
};

// The full recording -> transcribe -> score -> store pipeline. Runs inside a
// queue worker (see sessionWorker.ts), not inline in the HTTP request. Throws
// on failure so the caller can decide, based on retry attempt, whether to let
// the queue retry or mark the session as permanently errored.
export async function processSessionRecording(input: SessionRecordingInput): Promise<void> {
  const { audioBuffer, videoFrames, durationSeconds, audioGapEvents, faceLostEvents, silenceEvents } = input;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, input.sessionId))
    .limit(1);
  if (!session) throw new Error(`Session ${input.sessionId} not found`);

  let transcript: string | undefined;
  let speechDurationSeconds: number | null = null;
  let audioDeliveryAnalysis: string | undefined;
  let pitchVariationScore: number | null = null;
  let breathingScore: number | null = null;
  let breathingObservation: string | null = null;
  let clarityFlags: string | null = null;
  let professionalLanguageFlags: string | null = null;
  let fillerWordCount: number | null = null;
  let fillerWordObservation: string | null = null;
  let confidenceLanguageObservation: string | null = null;
  let structureObservation: string | null = null;
  let concisenessObservation: string | null = null;
  let videoPresenceAnalysis: VideoPresenceResult | null = null;
  let rmsMetrics: RmsMetrics | null = null;
  let f0Metrics: F0Metrics | null = null;
  let pauseMetrics = null;
  let wpmWindows = null;

  const videoPresencePromise: Promise<VideoPresenceResult | null> =
    session.mode === "video" && videoFrames.length > 0
      ? analyzeVideoPresence(
          videoFrames,
          session.promptText || undefined,
          session.recordingContext || "seated",
          session.id
        ).then(result => {
          logger.info({ sessionId: session.id }, "video presence analysis complete");
          return result;
        }).catch(err => {
          logger.error({ sessionId: session.id, err }, "video presence analysis failed");
          return null;
        })
      : Promise.resolve(null);
  if (session.mode === "video" && videoFrames.length === 0) {
    logger.warn({ sessionId: session.id }, "video session but no frames received — visual dimensions will not be assessable");
  }

  if (audioBuffer && audioBuffer.length > 0) {
    logger.info({ sessionId: session.id, rawBytes: audioBuffer.length }, "audio upload received — converting format");

    const { buffer: wavBuffer, format } = await ensureCompatibleFormat(audioBuffer);
    logger.info({ sessionId: session.id, detectedFormat: format, convertedBytes: wavBuffer.length }, "audio format ready");

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
      transcribeAudio(wavBuffer, session.id),
      analyzeAudioDelivery(wavBuffer, format, session.promptText || undefined, session.id),
    ]);

    if (transcriptResult.status === "fulfilled") {
      transcript = transcriptResult.value.transcript;
      speechDurationSeconds = transcriptResult.value.speechDurationSeconds;
      pauseMetrics = transcriptResult.value.pauseMetrics;
      wpmWindows = transcriptResult.value.wpmWindows;
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
      clarityFlags = dr.clarityFlags;
      professionalLanguageFlags = dr.professionalLanguageFlags;
      fillerWordCount = dr.fillerWordCount;
      fillerWordObservation = dr.fillerWordObservation;
      confidenceLanguageObservation = dr.confidenceLanguageObservation;
      structureObservation = dr.structureObservation;
      concisenessObservation = dr.concisenessObservation;
      logger.info({ sessionId: session.id, pitchVariationScore, breathingScore, fillerWordCount, hasClarityFlags: !!clarityFlags, hasProfessionalLanguageFlags: !!professionalLanguageFlags }, "delivery analysis complete");
    } else {
      logger.error({
        sessionId: session.id,
        err: deliveryResult.status === "rejected" ? deliveryResult.reason : "empty result",
      }, "delivery analysis failed");
    }
  } else {
    logger.warn({ sessionId: session.id }, "no audio buffer received — skipping transcription");
  }

  if (transcript && transcript.trim().length > 0) {
    await db
      .update(sessionsTable)
      .set({ transcript })
      .where(eq(sessionsTable.id, session.id));
  }

  videoPresenceAnalysis = await videoPresencePromise;

  const hasAudioContent =
    (transcript && transcript.trim().length > 0) ||
    (audioDeliveryAnalysis && audioDeliveryAnalysis.trim().length > 0);

  if (!hasAudioContent) {
    await db
      .update(sessionsTable)
      .set({
        processingStatus: "error",
        processingError: "No audio was captured in this recording. Please check your microphone is unmuted and record again.",
        durationSeconds,
      })
      .where(eq(sessionsTable.id, session.id));
    return;
  }

  const [prevCompletedSessions, [sessionUser]] = await Promise.all([
    db
      .select({ compositeScore: sessionsTable.compositeScore })
      .from(sessionsTable)
      .where(and(
        eq(sessionsTable.userId, session.userId),
        eq(sessionsTable.processingStatus, "complete"),
      ))
      .orderBy(desc(sessionsTable.createdAt)),
    db
      .select({ interviewMode: usersTable.interviewMode, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1),
  ]);

  const sessionNumber = prevCompletedSessions.length + 1;
  const previousCompositeScore =
    prevCompletedSessions.length > 0 && prevCompletedSessions[0].compositeScore
      ? parseFloat(prevCompletedSessions[0].compositeScore)
      : null;

  const result = await scoreSession({
    sessionId: session.id,
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
    clarityFlags,
    professionalLanguageFlags,
    fillerWordCount,
    fillerWordObservation,
    confidenceLanguageObservation,
    structureObservation,
    concisenessObservation,
    rmsMetrics,
    f0Metrics,
    pauseMetrics,
    wpmWindows,
    recordingContext: session.recordingContext || "seated",
    promptText: session.promptText || undefined,
    promptContext: getPromptContext(session.promptText || "") || undefined,
    structureFamily: getPromptStructureFamily(session.promptText || ""),
    sessionNumber,
    previousCompositeScore,
    interviewMode: sessionUser?.interviewMode ?? false,
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
  await db
    .update(usersTable)
    .set({ totalRecordingSeconds: sql`total_recording_seconds + ${durationSeconds}` })
    .where(eq(usersTable.id, session.userId));

  if (sessionUser?.email) {
    notifyAdminSessionScored(
      sessionUser.email,
      sessionUser.name ?? "there",
      result.compositeScore,
      result.compositeTier
    ).catch(err => {
      logger.error({ err, sessionId: session.id }, "Failed to send session-scored admin notification");
    });
  }
}
