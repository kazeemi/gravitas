// The audio models ingest the audio (audio_input_tokens > 0) but refuse to
// assess vocal qualities. This tests whether the refusal is promptable-around,
// which decides whether the fix is prompt wording or an architectural change.
//
//   node scripts/test-audio-prompt-framings.mjs

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
    input:
      "Thank you for having me. I lead our operations team, and this quarter we reduced " +
      "delivery times by thirty percent. It matters because our clients feel that difference daily.",
  }),
});
const wav = Buffer.from(await ttsRes.arrayBuffer());
const audioBase64 = wav.toString("base64");
console.log(`Speech sample: ${(wav.length / 1024).toFixed(0)} KB\n`);

// The exact prompt the pipeline sends, abbreviated only where it repeats.
const productionPrompt = `You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice — what you hear in the audio itself. Be specific; no generic statements. Ignore silence at the start/end; analyse only from first word to last word. Keep each field to 1-2 sentences.

Assess the following:

1. Articulation — Clarity and precision of word formation. Are endings dropped, words mumbled or slurred?
2. Projection — Does the voice carry consistently? Does volume drop at phrase endings or trail off?
3. Vocal Tone — Richness, warmth, resonance of the voice.
4. Breath Control — Does breath support full phrases, or does the voice thin at endings?

Return JSON with exactly these keys:
{
  "articulation": "1-2 sentence observation",
  "projection": "1-2 sentence observation",
  "vocalTone": "1-2 sentence observation",
  "breathControl": "1-2 sentence observation",
  "breathingScore": <integer 1-5>
}`;

const framings = [
  {
    name: "A. production prompt (verbatim)",
    system: null,
    text: productionPrompt,
  },
  {
    name: "B. production prompt + system role",
    system:
      "You are an audio analysis engine for a speech coaching product. You can hear the " +
      "attached audio. Describe only the acoustic qualities of the speech. Always reply with JSON.",
    text: productionPrompt,
  },
  {
    name: "C. framed as describing sound, not judging a person",
    system: null,
    text:
      "Listen to the attached recording and describe the SOUND you hear: how crisply consonants " +
      "are formed, whether loudness stays even or drops at phrase ends, the timbre, and whether " +
      "phrases are completed on one breath. Describe the audio signal, not the speaker's identity " +
      'or traits. Return ONLY JSON: {"articulation":"...","projection":"...","vocalTone":"...","breathControl":"...","breathingScore":3}',
  },
  {
    name: "D. transcribe-then-describe",
    system: null,
    text:
      "First transcribe the speech verbatim. Then, based on what you heard in the recording, " +
      "note anything about how clearly words were formed, whether volume was consistent, and " +
      'where breaths fell. Return ONLY JSON: {"transcript":"...","articulation":"...","projection":"...","breathControl":"...","breathingScore":3}',
  },
];

for (const f of framings) {
  const messages = [];
  if (f.system) messages.push({ role: "system", content: f.system });
  messages.push({
    role: "user",
    content: [
      { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
      { type: "text", text: f.text },
    ],
  });

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ model: "gpt-audio-mini", modalities: ["text"], messages }),
  });
  const json = await res.json().catch(() => ({}));
  const text = json.choices?.[0]?.message?.content ?? "";
  const tokens = json.usage?.prompt_tokens_details?.audio_tokens;
  const parsed = text.match(/\{[\s\S]*\}/);
  let ok = false;
  if (parsed) {
    try {
      JSON.parse(parsed[0]);
      ok = true;
    } catch {}
  }

  console.log(f.name);
  console.log(`  HTTP ${res.status} | audio_tokens=${tokens ?? "none"} | valid JSON: ${ok ? "YES" : "NO"}`);
  console.log(`  ${String(text).replace(/\s+/g, " ").slice(0, 300)}\n`);
}
