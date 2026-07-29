// Pipeline canary — detects provider-side breakage before a client does.
//
// Pushes a known speech sample through every external model the scoring
// pipeline depends on, and asserts the outputs the pipeline actually needs are
// present. Exits non-zero on any failure so it can drive a cron job or an alert.
//
// This exists because the audio delivery analysis broke silently for weeks: the
// API returned HTTP 200, the model declined in prose, scores became null, and
// sessions still completed with a plausible-looking report. A green canary means
// the pipeline is producing real vocal analysis, not just returning 200s.
//
//   node scripts/pipeline-canary.mjs            # human-readable
//   node scripts/pipeline-canary.mjs --json     # machine-readable

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const asJson = process.argv.includes("--json");

function envVar(name) {
  const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const openaiKey = envVar("AI_INTEGRATIONS_OPENAI_API_KEY");
const openaiBase = (envVar("AI_INTEGRATIONS_OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const claudeKey = envVar("CLAUDE_API_KEY");

// Keep in sync with the pins in the source.
const MODELS = {
  delivery: "gpt-audio-mini-2025-12-15",
  deliveryFallback: "gpt-audio-1.5",
  transcribe: "gpt-4o-mini-transcribe-2025-12-15",
  coaching: "claude-sonnet-4-6",
};

const AUDIO_SYSTEM_PROMPT =
  "You are an audio analysis engine for a speech coaching product. You can hear the " +
  "attached audio recording. Describe only the acoustic qualities of the speech — how " +
  "words are formed, how the volume behaves, the timbre, and where breaths fall. Do not " +
  "comment on the speaker's identity or personal characteristics. Always reply with JSON only.";

const ANALYSIS_PROMPT = `You are a senior executive presence coach listening to this audio recording. Focus exclusively on the RAW SONIC QUALITIES of the voice.

Assess: Articulation, Projection, Vocal Tone, Breath Control.

Return JSON with exactly these keys:
{"articulation":"...","projection":"...","vocalTone":"...","breathControl":"...","breathingScore":<1-5>}`;

const checks = [];
function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

// ── Sample ────────────────────────────────────────────────────────────────────
let audioBase64 = null;
let wav = null;
try {
  const res = await fetch(`${openaiBase}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      response_format: "wav",
      input: "Thank you for having me. I lead our operations team, and this quarter we reduced delivery times by thirty percent.",
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  wav = Buffer.from(await res.arrayBuffer());
  audioBase64 = wav.toString("base64");
  record("sample generation (tts-1)", true, `${(wav.length / 1024).toFixed(0)} KB`);
} catch (err) {
  record("sample generation (tts-1)", false, err.message);
}

// ── Delivery analysis ─────────────────────────────────────────────────────────
// The canary allows the same retry budget as production, so an intermittent
// refusal doesn't page anyone — only a sustained failure does.
async function deliveryAttempt(model) {
  const res = await fetch(`${openaiBase}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
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
  const audioTokens = json.usage?.prompt_tokens_details?.audio_tokens ?? 0;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, why: "refused (no JSON)" };
  try {
    const parsed = JSON.parse(m[0]);
    if (!Number.isFinite(Number(parsed.breathingScore))) return { ok: false, why: "no breathingScore" };
    return { ok: true, audioTokens, score: parsed.breathingScore };
  } catch {
    return { ok: false, why: "malformed JSON" };
  }
}

if (audioBase64) {
  const attempts = [MODELS.delivery, MODELS.delivery, MODELS.deliveryFallback];
  let result = null;
  let usedOn = 0;
  for (const [i, model] of attempts.entries()) {
    const r = await deliveryAttempt(model);
    if (r.ok) {
      result = { ...r, model };
      usedOn = i + 1;
      break;
    }
    result = r;
  }
  record(
    "vocal analysis (audio heard AND scored)",
    Boolean(result?.ok),
    result?.ok
      ? `${result.model} on attempt ${usedOn}, audio_tokens=${result.audioTokens}, breathingScore=${result.score}`
      : `all ${attempts.length} attempts failed — last: ${result?.why}`
  );
} else {
  record("vocal analysis (audio heard AND scored)", false, "skipped — no sample");
}

// ── Transcription ─────────────────────────────────────────────────────────────
if (wav) {
  try {
    const form = new FormData();
    form.append("file", new Blob([wav], { type: "audio/wav" }), "sample.wav");
    form.append("model", MODELS.transcribe);
    const res = await fetch(`${openaiBase}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const words = String((await res.json()).text ?? "").trim().split(/\s+/).filter(Boolean).length;
    record(`transcription (${MODELS.transcribe})`, words > 3, `${words} words`);
  } catch (err) {
    record(`transcription (${MODELS.transcribe})`, false, err.message);
  }
} else {
  record(`transcription (${MODELS.transcribe})`, false, "skipped — no sample");
}

// ── Coaching model ────────────────────────────────────────────────────────────
// Verifies the model answers and returns parseable JSON, the shape the scoring
// prompt depends on.
try {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.coaching,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content:
            'Return ONLY JSON, no prose: {"ok": true, "dimension": "structure", "score": 7}',
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status} ${String(body.error?.message ?? "").slice(0, 80)}`);
  }
  const body = await res.json();
  const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : null;
  record(`coaching model (${MODELS.coaching})`, parsed?.ok === true, parsed ? "returned valid JSON" : "no JSON returned");
} catch (err) {
  record(`coaching model (${MODELS.coaching})`, false, err.message);
}

// ── Report ────────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.ok);

if (asJson) {
  console.log(JSON.stringify({ healthy: failed.length === 0, checks }, null, 2));
} else {
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(
    failed.length === 0
      ? "\nPipeline healthy: every external model is producing the outputs scoring needs."
      : `\n${failed.length} check(s) FAILED. Sessions will produce degraded feedback until fixed.`
  );
}

process.exitCode = failed.length === 0 ? 0 : 1;
