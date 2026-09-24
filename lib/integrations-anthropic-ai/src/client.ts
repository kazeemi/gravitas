import Anthropic from "@anthropic-ai/sdk";

if (!process.env.CLAUDE_API_KEY) {
  throw new Error("CLAUDE_API_KEY must be set.");
}

// The SDK already retries connection errors, 408/409, 429, and 5xx with
// exponential backoff — this just widens that from the default of 2 attempts,
// since a burst of concurrent scoring calls (many users finishing sessions
// around the same time) makes hitting rate limits far more likely.
export const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  maxRetries: Number(process.env.ANTHROPIC_MAX_RETRIES ?? 5),
  timeout: 120_000,
});
