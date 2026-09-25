// Compares transcription models on a REAL Arabic audio file (dialect
// accuracy can't be tested with clean TTS audio — see
// compare-transcription-models.mjs for why). Prints each model's raw
// transcript side by side so accuracy can be judged by eye against the
// known ground truth of what was actually said.
//
//   node scripts/compare-arabic-transcription-models.mjs <path-to-audio-file>

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
function envVar(n) {
  const m = env.match(new RegExp(`^\\s*${n}\\s*=\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}
const key = envVar("AI_INTEGRATIONS_OPENAI_API_KEY");
const base = (envVar("AI_INTEGRATIONS_OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/compare-arabic-transcription-models.mjs <path-to-audio-file>");
  process.exit(1);
}
const audio = readFileSync(filePath);
const ext = filePath.split(".").pop() || "wav";

const CANDIDATES = [
  { model: "whisper-1", note: "current default" },
  { model: "gpt-4o-mini-transcribe-2025-12-15", note: "current fallback" },
  { model: "gpt-transcribe", note: "full (non-mini)" },
];

async function transcribe(model) {
  const form = new FormData();
  form.append("file", new Blob([audio]), `audio.${ext}`);
  form.append("model", model);
  form.append("language", "ar");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return { error: `HTTP ${res.status}: ${await res.text()}` };
  return { text: String((await res.json()).text ?? "").trim() };
}

console.log(`File: ${filePath} (${(audio.length / 1024).toFixed(0)} KB)\n`);

for (const c of CANDIDATES) {
  const t0 = Date.now();
  const r = await transcribe(c.model);
  const elapsed = Date.now() - t0;
  console.log(`── ${c.model} (${c.note}) — ${elapsed}ms ──`);
  if (r.error) {
    console.log(`  ERROR: ${r.error}\n`);
    continue;
  }
  console.log(`  ${r.text}\n`);
}

console.log("Read each transcript against what you actually said — look for the same");
console.log("kind of meaning-changing substitutions (not just spelling) seen before.");
