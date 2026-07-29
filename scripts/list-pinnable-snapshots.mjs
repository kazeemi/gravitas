// Lists the dated snapshots available for each model family this codebase uses,
// so a pin targets a real ID rather than a guessed one.
//
// Read-only.
//
//   node scripts/list-pinnable-snapshots.mjs

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

const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}
const ids = (await res.json()).data.map((m) => m.id).sort();

// The families actually referenced in the codebase.
const families = ["gpt-audio-mini", "gpt-audio", "gpt-4o-mini-transcribe"];

for (const family of families) {
  // A snapshot is the family name plus a trailing date.
  const dated = ids.filter((id) => new RegExp(`^${family}-\\d{4}-\\d{2}-\\d{2}$`).test(id));
  const aliasExists = ids.includes(family);
  console.log(`${family}`);
  console.log(`  moving alias present: ${aliasExists ? "yes" : "no"}`);
  if (dated.length === 0) {
    console.log(`  dated snapshots:      none — cannot pin, alias is the only form`);
  } else {
    for (const d of dated) console.log(`  dated snapshot:       ${d}`);
    console.log(`  newest:               ${dated[dated.length - 1]}`);
  }
  console.log();
}

console.log("Note: a dated snapshot can later be deprecated and start returning 404,");
console.log("which is why pinning only works alongside the canary that detects it.");
