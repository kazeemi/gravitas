// Read-only check of the Resend email setup.
//
// Verifies the API key works and reports which sending domains are verified.
// Emails can only be sent from a verified domain, so an unverified domain is
// the usual reason signup verification emails silently fail.
//
// Prints no secrets.
//
//   node scripts/check-email-setup.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");

function envVar(name) {
  const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const key = envVar("RESEND_API_KEY");
if (!key) {
  console.error("RESEND_API_KEY not found in .env.local");
  process.exit(1);
}

console.log(`API key present: yes (${key.slice(0, 4)}…, ${key.length} chars)`);

const res = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${key}` },
});

console.log(`Resend API response: ${res.status} ${res.statusText}`);

if (res.status === 401 || res.status === 403) {
  console.error("\nThe API key is not valid. Regenerate it in the Resend dashboard.");
  process.exit(1);
}

const body = await res.json();

if (!res.ok) {
  console.error(`\nUnexpected response: ${JSON.stringify(body)}`);
  process.exit(1);
}

const domains = body.data ?? [];
if (domains.length === 0) {
  console.log("\nNo sending domains configured in Resend at all.");
  console.log("Nothing can be sent from @selfcraftpartners.com until one is added and verified.");
} else {
  console.log(`\nSending domains (${domains.length}):`);
  for (const d of domains) {
    console.log(`  ${d.name.padEnd(30)} status=${d.status}  region=${d.region ?? "?"}`);
  }
}

// The app sends from these two addresses.
const needed = ["selfcraftpartners.com"];
console.log("\nWhat the app needs:");
for (const n of needed) {
  const match = domains.find((d) => d.name === n);
  if (!match) {
    console.log(`  ${n}: NOT PRESENT in Resend — sending will fail`);
  } else if (match.status !== "verified") {
    console.log(`  ${n}: present but status="${match.status}" — sending will fail until verified`);
  } else {
    console.log(`  ${n}: verified — sending should work`);
  }
}
