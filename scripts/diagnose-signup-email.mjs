// Diagnoses why a signup verification email did not arrive.
//
// Read-only. Checks whether the account exists and whether Resend has any
// record of a recent send. Prints no tokens or secrets.
//
//   node scripts/diagnose-signup-email.mjs <email>

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;

const env = readFileSync(join(here, "..", ".env.local"), "utf8");
function envVar(name) {
  const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const target = (process.argv[2] || "").toLowerCase();
if (!target) {
  console.error("Usage: node scripts/diagnose-signup-email.mjs <email>");
  process.exit(1);
}

// --- 1. Did the account get created? ---
const client = new pg.Client({ connectionString: envVar("DATABASE_URL") });
await client.connect();
const { rows } = await client.query(
  `SELECT email, name, email_verified, is_admin,
          email_verification_token IS NOT NULL AS has_token,
          email_verification_expires_at,
          consent_accepted_at IS NOT NULL AS consented,
          recording_seconds_allowance,
          created_at
     FROM users WHERE email = $1`,
  [target]
);
await client.end();

if (rows.length === 0) {
  console.log(`ACCOUNT: no user row for ${target} — signup did not complete`);
} else {
  const u = rows[0];
  console.log(`ACCOUNT for ${u.email}:`);
  console.log(`  created:            ${u.created_at.toISOString()}`);
  console.log(`  email_verified:     ${u.email_verified}`);
  console.log(`  is_admin:           ${u.is_admin}`);
  console.log(`  verification token: ${u.has_token ? "present" : "MISSING"}`);
  console.log(`  token expires:      ${u.email_verification_expires_at?.toISOString() ?? "n/a"}`);
  console.log(`  consent recorded:   ${u.consented}`);
  console.log(`  allowance:          ${u.recording_seconds_allowance}s (${Math.round(u.recording_seconds_allowance / 60)} min)`);
}

// --- 2. Does Resend have any record of sending it? ---
const key = envVar("RESEND_API_KEY");
const res = await fetch("https://api.resend.com/emails", {
  headers: { Authorization: `Bearer ${key}` },
});

console.log(`\nRESEND send log: HTTP ${res.status}`);
if (res.ok) {
  const body = await res.json();
  const list = body.data ?? [];
  if (list.length === 0) {
    console.log("  no emails recorded — nothing has been sent through this API key");
  } else {
    console.log(`  ${list.length} recent email(s):`);
    for (const e of list.slice(0, 10)) {
      const to = Array.isArray(e.to) ? e.to.join(",") : e.to;
      console.log(`    ${e.created_at}  to=${to}  subject="${e.subject}"  status=${e.last_event ?? "?"}`);
    }
  }
} else {
  console.log(`  could not list emails: ${JSON.stringify(await res.json()).slice(0, 300)}`);
  console.log("  (listing may not be permitted for this key — not necessarily a fault)");
}
