// Tests whether the audio models actually analyse real speech, using OpenAI TTS
// to generate a genuine spoken sample (a synthetic tone can provoke a refusal
// that tells us nothing).
//
// Compares gpt-audio-mini (used by analyzeAudioDelivery) against gpt-audio
// (used elsewhere in the audio library).
//
//   node scripts/test-audio-models.mjs

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

// --- 1. Generate real speech via TTS ---
console.log("Generating real speech via tts-1...");
const ttsRes = await fetch(`${base}/audio/speech`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    model: "tts-1",
    voice: "alloy",
    response_format: "wav",
    input:
      "Thank you for having me. I lead our operations team, and this quarter we reduced " +
      "delivery times by thirty percent. It matters because our clients feel that difference daily.",
  }),
});

if (!ttsRes.ok) {
  console.error(`TTS failed: HTTP ${ttsRes.status}`);
  console.error(JSON.stringify(await ttsRes.json().catch(() => ({})), null, 2));
  process.exit(1);
}

const wav = Buffer.from(await ttsRes.arrayBuffer());
const audioBase64 = wav.toString("base64");
console.log(`Speech WAV: ${(wav.length / 1024).toFixed(0)} KB\n`);

// The real prompt shape: asks for strict JSON, as the pipeline does.
const prompt =
  "You are an executive presence coach listening to this audio. Assess articulation, " +
  "projection and breath control from the sound of the voice. " +
  'Return ONLY JSON: {"articulation":"...","projection":"...","breathControl":"...","breathingScore":3}';

async function tryModel(model, modalities) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      model,
      ...(modalities ? { modalities } : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  const json = await res.json().catch(() => ({}));
  const label = `${model}${modalities ? ` modalities=${JSON.stringify(modalities)}` : " (no modalities field)"}`;

  if (!res.ok) {
    console.log(`${label}\n  HTTP ${res.status} — ${JSON.stringify(json.error?.message ?? json).slice(0, 200)}\n`);
    return;
  }

  const text = json.choices?.[0]?.message?.content ?? "";
  const audioTokens = json.usage?.prompt_tokens_details?.audio_tokens;
  const hasJson = /\{[\s\S]*\}/.test(text);
  const refused = /can't|cannot|unable to (analyz|listen|hear)/i.test(text);

  console.log(label);
  console.log(`  HTTP 200 | audio_input_tokens=${audioTokens ?? "none"} | returns JSON: ${hasJson ? "YES" : "NO"}${refused ? " | REFUSAL" : ""}`);
  console.log(`  reply: ${String(text).replace(/\s+/g, " ").slice(0, 260)}\n`);
}

console.log("=== Testing the shape the pipeline uses ===");
await tryModel("gpt-audio-mini", ["text"]);

console.log("=== Variations ===");
await tryModel("gpt-audio-mini", null);
await tryModel("gpt-audio", ["text"]);

console.log("Note: audio_input_tokens > 0 proves the model actually ingested the audio.");
