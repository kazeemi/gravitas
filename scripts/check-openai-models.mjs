// Lists the audio-capable OpenAI models the configured key can reach, and
// checks the specific model names this codebase asks for.
//
// Read-only. Prints no secrets.
//
//   node scripts/check-openai-models.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");

function envVar(name) {
  const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const key = envVar("AI_INTEGRATIONS_OPENAI_API_KEY");
const base = envVar("AI_INTEGRATIONS_OPENAI_BASE_URL") || "https://api.openai.com/v1";

const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
  headers: { Authorization: `Bearer ${key}` },
});

console.log(`GET ${base}/models -> HTTP ${res.status}`);
if (!res.ok) {
  console.error(JSON.stringify(await res.json().catch(() => ({})), null, 2));
  process.exit(1);
}

const models = (await res.json()).data.map((m) => m.id).sort();

console.log(`\nAudio / transcribe models available (${models.length} total models):`);
for (const id of models) {
  if (/audio|transcribe|whisper|realtime|tts/.test(id)) console.log(`  ${id}`);
}

// The names this codebase requests.
const required = ["gpt-audio-mini", "gpt-audio", "gpt-4o-mini-transcribe"];
console.log("\nModels this codebase asks for:");
for (const id of required) {
  console.log(`  ${id.padEnd(26)} ${models.includes(id) ? "AVAILABLE" : "NOT AVAILABLE  <-- calls using this fail"}`);
}
