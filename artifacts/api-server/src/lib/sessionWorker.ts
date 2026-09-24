import { Worker, type Job } from "bullmq";
import { readFile, unlink } from "fs/promises";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { sessionsTable } from "@workspace/db";
import { redisConnection } from "./redis.js";
import { SESSION_PROCESSING_QUEUE, type SessionProcessingJobData } from "./sessionQueue.js";
import { processSessionRecording } from "./sessionProcessing.js";
import { notifyAdminSessionFailed } from "./email.js";

// How many recordings this instance will process at once. Tune based on load
// testing against actual server CPU/memory and the AI providers' rate limits
// — this is the knob that prevents 100 simultaneous uploads from all running
// ffmpeg + scoring at once and taking the whole process down.
const CONCURRENCY = Number(process.env.SESSION_PROCESSING_CONCURRENCY ?? 8);

async function cleanupFiles(data: SessionProcessingJobData): Promise<void> {
  for (const path of [data.audioFilePath, data.videoFramesFilePath]) {
    if (!path) continue;
    await unlink(path).catch(err => {
      logger.warn({ err, path }, "failed to delete temp session file — will be swept by tmp cleanup");
    });
  }
}

async function processJob(job: Job<SessionProcessingJobData>): Promise<void> {
  const { sessionId, audioFilePath, videoFramesFilePath, durationSeconds, audioGapEvents, faceLostEvents, silenceEvents } = job.data;

  const audioBuffer = audioFilePath ? await readFile(audioFilePath) : null;
  let videoFrames: string[] = [];
  if (videoFramesFilePath) {
    try {
      const raw = await readFile(videoFramesFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) videoFrames = parsed.filter((f): f is string => typeof f === "string");
    } catch (err) {
      logger.error({ err, sessionId }, "failed to read/parse video frames file");
    }
  }

  await processSessionRecording({
    sessionId,
    audioBuffer,
    videoFrames,
    durationSeconds,
    audioGapEvents,
    faceLostEvents,
    silenceEvents,
  });
}

export function startSessionWorker(): Worker<SessionProcessingJobData> {
  const worker = new Worker<SessionProcessingJobData>(
    SESSION_PROCESSING_QUEUE,
    processJob,
    { connection: redisConnection, concurrency: CONCURRENCY },
  );

  // Files are only ever deleted once we know no further retry will need
  // them: on success, or once retries are exhausted. We never keep raw
  // recordings around once feedback has been generated (or definitively
  // failed to generate).
  worker.on("completed", job => {
    cleanupFiles(job.data).catch(err => logger.error({ err, sessionId: job.data.sessionId }, "cleanup after completion failed"));
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.error({ err, sessionId: job.data.sessionId, attempt: job.attemptsMade, isFinalAttempt }, "session processing job failed");
    if (isFinalAttempt) {
      await db
        .update(sessionsTable)
        .set({
          processingStatus: "error",
          processingError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(sessionsTable.id, job.data.sessionId))
        .catch(dbErr => logger.error({ dbErr, sessionId: job.data.sessionId }, "failed to mark session as errored after exhausting retries"));
      await cleanupFiles(job.data);
      notifyAdminSessionFailed(
        job.data.sessionId,
        err instanceof Error ? err.message : String(err)
      ).catch(notifyErr => logger.error({ notifyErr, sessionId: job.data.sessionId }, "failed to send session-failed admin alert"));
    }
  });

  worker.on("error", err => {
    logger.error({ err }, "session processing worker error");
  });

  logger.info({ concurrency: CONCURRENCY }, "session processing worker started");
  return worker;
}
