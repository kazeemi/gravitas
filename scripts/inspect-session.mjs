// Inspects the most recent session for an account and reports which analysis
// inputs were actually captured, so a degraded pipeline is visible.
//
// Read-only.
//
//   node scripts/inspect-session.mjs <email>

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;

const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const url = env.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, "");

const target = (process.argv[2] || "").toLowerCase();
if (!target) {
  console.error("Usage: node scripts/inspect-session.mjs <email>");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: sessions } = await client.query(
  `SELECT s.* FROM sessions s
     JOIN users u ON u.id = s.user_id
    WHERE u.email = $1
    ORDER BY s.created_at DESC
    LIMIT 1`,
  [target]
);

if (sessions.length === 0) {
  console.log(`No sessions found for ${target}`);
  await client.end();
  process.exit(0);
}

const s = sessions[0];
console.log(`SESSION ${s.id}`);
console.log(`  created:      ${s.created_at.toISOString()}`);
console.log(`  mode:         ${s.mode}`);
console.log(`  status:       ${s.processing_status}`);
console.log(`  duration:     ${s.duration_seconds}s`);
console.log(`  composite:    ${s.composite_score} (${s.composite_tier})`);
console.log(`  transcript:   ${s.transcript ? s.transcript.length + " chars" : "MISSING"}`);

// Which audio/video analysis inputs survived the pipeline?
const signals = [
  "audio_delivery_analysis",
  "pitch_variation_score",
  "breathing_score",
  "breathing_observation",
  "clarity_flags",
  "professional_language_flags",
  "filler_word_count",
  "speech_duration_seconds",
  "video_presence_analysis",
];

console.log(`\nANALYSIS INPUTS:`);
for (const col of signals) {
  if (!(col in s)) {
    console.log(`  ${col.padEnd(30)} (column not present)`);
    continue;
  }
  const v = s[col];
  const state =
    v === null || v === undefined
      ? "NULL  <-- not captured"
      : typeof v === "string"
        ? `${v.length} chars`
        : String(v);
  console.log(`  ${col.padEnd(30)} ${state}`);
}

// Per-dimension raw metrics tell us what the scorer actually had to work with.
const { rows: dims } = await client.query(
  `SELECT dimension_key, score, tier, raw_metrics
     FROM dimension_scores WHERE session_id = $1
     ORDER BY score ASC`,
  [s.id]
);

console.log(`\nDIMENSIONS (${dims.length}), lowest first:`);
for (const d of dims) {
  const hasRaw = d.raw_metrics && Object.keys(d.raw_metrics).length > 0;
  console.log(
    `  ${String(d.score).padStart(4)}  ${d.dimension_key.padEnd(26)} ${d.tier.padEnd(14)} rawMetrics=${hasRaw ? Object.keys(d.raw_metrics).join(",") : "none"}`
  );
}

// Plausible acoustic values prove the audio really was decoded to PCM.
// Zeros or absurd numbers would mean an unconverted container was misparsed.
console.log(`\nACOUSTIC VALUES (sanity check):`);
for (const d of dims) {
  const rm = d.raw_metrics || {};
  const acoustic = Object.entries(rm).filter(([k]) => /rms|f0|voiced|wordsPerMinute/i.test(k));
  if (acoustic.length) {
    console.log(`  ${d.dimension_key}:`);
    for (const [k, v] of acoustic) console.log(`     ${String(k).padEnd(20)} ${v}`);
  }
}

await client.end();
