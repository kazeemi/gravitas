// Attempts a real send through Resend using the key in .env.local, and reports
// the full error if it fails.
//
// This distinguishes two very different problems:
//   - the key itself cannot send (invalid, or restricted to read-only)
//   - the key is fine, so the copy configured on the host is wrong
//
//   node scripts/test-send-email.mjs <recipient>

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
const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-send-email.mjs <recipient>");
  process.exit(1);
}

// Same sender the app uses, so this tests the real configuration.
const from = "Gravitas <noreply@selfcraftpartners.com>";

console.log(`Sending from: ${from}`);
console.log(`Sending to:   ${to}`);
console.log(`Key:          ${key.slice(0, 4)}… (${key.length} chars)\n`);

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to,
    subject: "Gravitas email delivery test",
    html: "<p>This is a delivery test from Gravitas. If you received it, sending works.</p>",
  }),
});

const body = await res.json().catch(() => ({}));

console.log(`HTTP ${res.status} ${res.statusText}`);
console.log(JSON.stringify(body, null, 2));

if (res.ok) {
  console.log("\nRESULT: the key CAN send. If the deployed app cannot, the value");
  console.log("configured on the host does not match this one.");
} else {
  console.log("\nRESULT: the key CANNOT send. The error above is the real cause —");
  console.log("the same failure the deployed app is hitting.");
  process.exitCode = 1;
}
