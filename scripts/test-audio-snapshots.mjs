// Tests whether the refusal is new behaviour introduced by a model update, by
// sending the same production prompt to each dated snapshot of gpt-audio-mini.
//
// If older snapshots comply and newer ones refuse, the alias moving is the cause
// and nothing about our own deployment changed.
//
//   node scripts/test-audio-snapshots.mjs

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

const productionPrompt = `You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice — what you hear in the audio itself.

Assess: Articulation, Projection, Vocal Tone, Breath Control.

Return JSON with exactly these keys:
{"articulation":"...","projection":"...","vocalTone":"...","breathControl":"...","breathingScore":<1-5>}`;

const models = [
  "gpt-audio-mini",
  "gpt-audio-mini-2025-10-06",
  "gpt-audio-mini-2025-12-15",
  "gpt-audio",
  "gpt-audio-2025-08-28",
  "gpt-audio-1.5",
];

console.log("Same production prompt, no system message, across snapshots:\n");

for (const model of models) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      model,
      modalities: ["text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
            { type: "text", text: productionPrompt },
          ],
        },
      ],
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`  ${model.padEnd(28)} HTTP ${res.status} ${String(json.error?.message ?? "").slice(0, 70)}`);
    continue;
  }
  const text = json.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  let ok = false;
  if (m) {
    try {
      JSON.parse(m[0]);
      ok = true;
    } catch {}
  }
  console.log(`  ${model.padEnd(28)} ${ok ? "COMPLIED (valid JSON)" : "REFUSED"}`);
}
