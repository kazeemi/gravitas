// Reproduces the gpt-audio-mini request that analyzeAudioDelivery makes, using
// a synthesised 16 kHz mono WAV, and prints the full error if it fails.
//
// The point is to test the request SHAPE and model behaviour, not the content:
// if the API rejects the structure, that is the bug the pipeline is hitting.
//
//   node scripts/test-audio-delivery-call.mjs

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

// --- Build a 3 second 16 kHz mono PCM WAV: a 220 Hz tone, so there is
// --- something voiced for the model to comment on.
function makeWav(seconds = 3, rate = 16000, freq = 220) {
  const samples = seconds * rate;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    // Fade amplitude so it is not a harsh constant tone.
    const env = Math.sin((Math.PI * i) / samples);
    const v = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000 * env);
    data.writeInt16LE(v, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);          // PCM
  header.writeUInt16LE(1, 22);          // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);   // byte rate
  header.writeUInt16LE(2, 32);          // block align
  header.writeUInt16LE(16, 34);         // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const wav = makeWav();
const audioBase64 = wav.toString("base64");
console.log(`Synthesised WAV: ${(wav.length / 1024).toFixed(0)} KB -> ${(audioBase64.length / 1024).toFixed(0)} KB base64`);

// Exactly the request shape used in artifacts/api-server/src/lib/scoring.ts
const body = {
  model: "gpt-audio-mini",
  modalities: ["text"],
  messages: [
    {
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
        { type: "text", text: 'Describe this audio in one sentence. Return JSON: {"observation": "..."}' },
      ],
    },
  ],
};

console.log(`\nPOST ${base}/chat/completions  (model=${body.model}, modalities=${JSON.stringify(body.modalities)})`);

const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const json = await res.json().catch(() => ({}));

console.log(`HTTP ${res.status} ${res.statusText}\n`);

if (res.ok) {
  console.log("SUCCESS — the request shape is accepted.");
  console.log(`Model replied: ${JSON.stringify(json.choices?.[0]?.message?.content ?? json).slice(0, 400)}`);
} else {
  console.log("FAILED — this is the error the pipeline is hitting:");
  console.log(JSON.stringify(json, null, 2).slice(0, 1500));
  process.exitCode = 1;
}
