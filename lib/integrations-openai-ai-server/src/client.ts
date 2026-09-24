import OpenAI from "openai";

function getClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    // Widen the SDK's built-in retry-with-backoff (connection errors, 429,
    // 5xx) past its default of 2 attempts — see audio/client.ts for the same
    // change and reasoning.
    maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 5),
    timeout: 120_000,
  });
}

export const openai = new Proxy({} as OpenAI, {
  get(_, prop) {
    return (getClient() as any)[prop];
  },
});
