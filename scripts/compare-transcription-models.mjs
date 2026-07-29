// Compares transcription models on a known sentence so the choice is measured
// rather than assumed. Also checks each candidate exists and returns text, since
// a pinned ID that 404s breaks scoring outright.
//
//   node scripts/compare-transcription-models.mjs

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

// The sentence that was mis-transcribed in production.
const TRUTH = "I am an executive coach and leadership development advisor";

const ttsRes = await fetch(`${base}/audio/speech`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "tts-1", voice: "alloy", response_format: "wav", input: TRUTH }),
});
const wav = Buffer.from(await ttsRes.arrayBuffer());

const CANDIDATES = [
  { model: "gpt-4o-mini-transcribe-2025-12-15", note: "current pin" },
  { model: "gpt-transcribe", note: "full (non-mini)" },
  { model: "whisper-1", note: "legacy" },
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
const truthWords = norm(TRUTH);

async function transcribe(model, withLanguage) {
  const form = new FormData();
  form.append("file", new Blob([wav], { type: "audio/wav" }), "s.wav");
  form.append("model", model);
  if (withLanguage) form.append("language", "en");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return { text: String((await res.json()).text ?? "").trim() };
}

console.log(`Truth: "${TRUTH}"\n`);

for (const c of CANDIDATES) {
  for (const withLang of [false, true]) {
    const r = await transcribe(c.model, withLang);
    const label = `${c.model}${withLang ? " +language=en" : ""}`;
    if (r.error) {
      console.log(`  ${label.padEnd(46)} ${r.error}`);
      continue;
    }
    const got = norm(r.text);
    const matched = truthWords.filter((w, i) => got[i] === w).length;
    const pct = Math.round((matched / truthWords.length) * 100);
    console.log(`  ${label.padEnd(46)} ${String(pct).padStart(3)}% exact-position match`);
    if (pct < 100) console.log(`      got: "${r.text}"`);
  }
}

console.log("\nNote: TTS audio is unusually clean, so high scores here do not prove");
console.log("accuracy on real accented speech — this checks availability and relative");
console.log("behaviour, not real-world word error rate.");
