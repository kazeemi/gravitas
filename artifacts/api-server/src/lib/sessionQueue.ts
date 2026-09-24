import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const SESSION_PROCESSING_QUEUE = "session-processing";

export type SessionProcessingJobData = {
  sessionId: string;
  audioFilePath: string | null;
  videoFramesFilePath: string | null;
  durationSeconds: number;
  audioGapEvents: number;
  faceLostEvents: number;
  silenceEvents: number;
};

export const sessionQueue = new Queue<SessionProcessingJobData>(SESSION_PROCESSING_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: 24 * 60 * 60 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  },
});

export async function enqueueSessionProcessing(data: SessionProcessingJobData): Promise<void> {
  await sessionQueue.add(SESSION_PROCESSING_QUEUE, data, { jobId: data.sessionId });
}
