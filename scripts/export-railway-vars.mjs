// Writes the environment variables the deployed app needs to a file, in
// NAME=value form, so they can be copied into a host's variable editor without
// transcription errors.
//
// DATABASE_URL is emitted with its password percent-encoded, because the raw
// password contains characters that get mangled when pasted into a web form.
//
// The output file contains live secrets — delete it once you are done.
//
//   node scripts/export-railway-vars.mjs <output-file> [APP_URL]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");

function envVar(name) {
  const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const outPath = process.argv[2];
const appUrl = process.argv[3];
if (!outPath) {
  console.error("Usage: node scripts/export-railway-vars.mjs <output-file> [APP_URL]");
  process.exit(1);
}

const dbRaw = envVar("DATABASE_URL");
const u = new URL(dbRaw);
const dbSafe = `${u.protocol}//${u.username}:${encodeURIComponent(u.password)}@${u.hostname}:${u.port}${u.pathname}`;

const vars = {
  DATABASE_URL: dbSafe,
  SESSION_SECRET: envVar("SESSION_SECRET"),
  CLAUDE_API_KEY: envVar("CLAUDE_API_KEY"),
  AI_INTEGRATIONS_OPENAI_API_KEY: envVar("AI_INTEGRATIONS_OPENAI_API_KEY"),
  AI_INTEGRATIONS_OPENAI_BASE_URL: envVar("AI_INTEGRATIONS_OPENAI_BASE_URL"),
  RESEND_API_KEY: envVar("RESEND_API_KEY"),
  NODE_ENV: "production",
};

if (appUrl) {
  vars.APP_URL = appUrl;
  vars.ALLOWED_ORIGINS = appUrl;
}

const missing = Object.entries(vars).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing from .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
writeFileSync(outPath, lines.join("\n") + "\n");

console.log(`Wrote ${lines.length} variables to ${outPath}\n`);
for (const [k, v] of Object.entries(vars)) {
  console.log(`  ${k.padEnd(34)} ${v.length} chars`);
}
console.log("\nExact names matter — a misspelled name reads as absent to the app.");
console.log("Delete the file once the variables are in place.");
