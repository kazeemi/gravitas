// Measures how reliably each candidate audio model completes the delivery
// analysis, by repeating the exact production request several times.
//
// A model that complies once and refuses twice is not a safe primary. Choosing
// the primary on a single successful call is how a flaky model ends up in front
// of a client.
//
//   node scripts/measure-audio-model-reliability.mjs [runs]

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
const auth = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const RUNS = Number(process.argv[2] || 4);
const CANDIDATES = [
  "gpt-audio-mini",
  "gpt-audio-mini-2025-12-15",
  "gpt-audio-1.5",
  "gpt-audio",
];

const AUDIO_SYSTEM_PROMPT =
  "You are an audio analysis engine for a speech coaching product. You can hear the " +
  "attached audio recording. Describe only the acoustic qualities of the speech — how " +
  "words are formed, how the volume behaves, the timbre, and where breaths fall. Do not " +
  "comment on the speaker's identity or personal characteristics. Always reply with JSON only.";

const ANALYSIS_PROMPT = `You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice.

Assess: Articulation, Projection, Vocal Tone, Breath Control.

Return JSON with exactly these keys:
{"articulation":"...","projection":"...","vocalTone":"...","breathControl":"...","breathingScore":<1-5>}`;

const ttsRes = await fetch(`${base}/audio/speech`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    model: "tts-1",
    voice: "alloy",
    response_format: "wav",
    input: "Thank you for having me. I lead our operations team, and this quarter we reduced delivery times by thirty percent.",
  }),
});
const audioBase64 = Buffer.from(await ttsRes.arrayBuffer()).toString("base64");

async function attempt(model) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: auth,
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
  if (!res.ok) return { ok: false, why: `HTTP ${res.status}` };
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, why: "refused" };
  try {
    const parsed = JSON.parse(m[0]);
    if (!Number.isFinite(Number(parsed.breathingScore))) return { ok: false, why: "no score" };
    return { ok: true };
  } catch {
    return { ok: false, why: "bad JSON" };
  }
}

console.log(`${RUNS} runs per model, identical production request:\n`);

for (const model of CANDIDATES) {
  const results = [];
  for (let i = 0; i < RUNS; i++) results.push(await attempt(model));
  const passed = results.filter((r) => r.ok).length;
  const reasons = [...new Set(results.filter((r) => !r.ok).map((r) => r.why))];
  console.log(
    `  ${model.padEnd(28)} ${passed}/${RUNS} succeeded${reasons.length ? `   (failures: ${reasons.join(", ")})` : ""}`
  );
}

console.log("\nPick the primary on consistency, not on a single lucky call.");
