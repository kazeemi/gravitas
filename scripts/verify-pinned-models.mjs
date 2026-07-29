// Verifies that each pinned model snapshot actually works with the exact request
// shape the pipeline uses — before pinning to it, and again after any pin change.
//
// A pin to a plausible-looking but wrong or deprecated ID is a 404 at scoring
// time, so this check is not optional.
//
//   node scripts/verify-pinned-models.mjs

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
const base = (envVar("AI_INTEGRATIONS_OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const auth = { Authorization: `Bearer ${key}` };

// Keep in sync with the pins in the source. If you change a pin, change it here.
const PINS = {
  delivery: "gpt-audio-mini-2025-12-15",
  deliveryFallback: "gpt-audio-1.5",
  transcribe: "gpt-4o-mini-transcribe-2025-12-15",
};

// The system message the pipeline sends. Without it the current snapshots
// decline to assess vocal qualities.
const AUDIO_SYSTEM_PROMPT =
  "You are an audio analysis engine for a speech coaching product. You can hear the " +
  "attached audio recording. Describe only the acoustic qualities of the speech — how " +
  "words are formed, how the volume behaves, the timbre, and where breaths fall. Do not " +
  "comment on the speaker's identity or personal characteristics. Always reply with JSON only.";

const ANALYSIS_PROMPT = `You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice.

Assess: Articulation, Projection, Vocal Tone, Breath Control.

Return JSON with exactly these keys:
{"articulation":"...","projection":"...","vocalTone":"...","breathControl":"...","breathingScore":<1-5>}`;

let failures = 0;

function report(name, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// --- Generate a real speech sample once, shared by the checks below. ---
console.log("Generating a speech sample via tts-1...");
const ttsRes = await fetch(`${base}/audio/speech`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "tts-1",
    voice: "alloy",
    response_format: "wav",
    input:
      "Thank you for having me. I lead our operations team, and this quarter we reduced " +
      "delivery times by thirty percent.",
  }),
});
if (!ttsRes.ok) {
  console.error(`Could not generate a sample: HTTP ${ttsRes.status}`);
  process.exit(1);
}
const wav = Buffer.from(await ttsRes.arrayBuffer());
const audioBase64 = wav.toString("base64");
console.log(`Sample ready: ${(wav.length / 1024).toFixed(0)} KB\n`);

// --- 1. Delivery analysis: the pinned snapshot must return parseable JSON. ---
async function checkDelivery(label, model) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      modalities: ["text"],
      messages: [
        { role: "system", content: AUDIO_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
            { type: "text", text: ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    report(`${label} (${model})`, false, `HTTP ${res.status} ${String(body.error?.message ?? "").slice(0, 90)}`);
    return;
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  const audioTokens = json.usage?.prompt_tokens_details?.audio_tokens ?? 0;
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    report(`${label} (${model})`, false, `no JSON returned — likely a refusal: "${String(text).replace(/\s+/g, " ").slice(0, 80)}"`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    report(`${label} (${model})`, false, "returned malformed JSON");
    return;
  }
  // The pipeline needs breathingScore specifically — a reply that parses but
  // omits it still produces a session with missing dimensions.
  const hasScore = Number.isFinite(Number(parsed.breathingScore));
  report(
    `${label} (${model})`,
    hasScore && audioTokens > 0,
    `audio_tokens=${audioTokens}, breathingScore=${hasScore ? parsed.breathingScore : "MISSING"}`
  );
}

console.log("Delivery analysis (audio must be ingested AND scored):");
await checkDelivery("primary", PINS.delivery);
await checkDelivery("fallback", PINS.deliveryFallback);

// --- 2. Transcription: the pinned snapshot must return text. ---
console.log("\nTranscription:");
const form = new FormData();
form.append("file", new Blob([wav], { type: "audio/wav" }), "sample.wav");
form.append("model", PINS.transcribe);
const trRes = await fetch(`${base}/audio/transcriptions`, {
  method: "POST",
  headers: auth,
  body: form,
});
if (!trRes.ok) {
  const body = await trRes.json().catch(() => ({}));
  report(`transcribe (${PINS.transcribe})`, false, `HTTP ${trRes.status} ${String(body.error?.message ?? "").slice(0, 90)}`);
} else {
  const body = await trRes.json();
  const words = String(body.text ?? "").trim().split(/\s+/).filter(Boolean).length;
  report(`transcribe (${PINS.transcribe})`, words > 3, `${words} words`);
}

console.log(
  failures === 0
    ? "\nAll pinned models verified against the real request shape."
    : `\n${failures} check(s) failed — do not pin to a failing model.`
);
process.exitCode = failures === 0 ? 0 : 1;
