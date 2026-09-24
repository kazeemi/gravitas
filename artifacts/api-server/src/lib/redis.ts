import IORedis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error(
    "REDIS_URL must be set. Provision Redis (e.g. Railway's Redis add-on) and link it to this service.",
  );
}

// BullMQ requires this for its blocking commands.
export const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
