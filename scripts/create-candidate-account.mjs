// Creates a single pre-verified, onboarding-skipped candidate account with a
// username+password login (no real email required) and a language flag.
//
// Used for client events where candidates log in with a username/password
// provided on the day, rather than their own email address.
//
//   node scripts/create-candidate-account.mjs <username> <password> [language]
//
// language defaults to "en"; pass "ar" for Arabic speech + Arabic feedback.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;
const bcrypt = (
  await import(pathToFileURL(join(here, "..", "artifacts", "api-server", "node_modules", "bcryptjs", "index.js")).href)
).default;

const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

const [username, password, language = "en"] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: node scripts/create-candidate-account.mjs <username> <password> [language]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters");
  process.exit(1);
}
if (!["en", "ar"].includes(language)) {
  console.error('language must be "en" or "ar"');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  // Synthetic placeholder — `email` stays NOT NULL/unique on the users table,
  // but login for this account goes through `username`, not this address.
  const placeholderEmail = `candidate-${randomUUID()}@candidates.gravitas.local`;

  const { rows } = await client.query(
    `INSERT INTO users (
        email, username, password_hash, name, language,
        email_verified, onboarding_completed,
        consent_accepted_at, privacy_policy_version, terms_version
      ) VALUES ($1, $2, $3, $4, $5, true, false, now(), '1.2', '2.0')
      RETURNING id, username, language`,
    [placeholderEmail, username, passwordHash, username, language]
  );

  console.log(`Created candidate account:`);
  console.log(`  username: ${rows[0].username}`);
  console.log(`  language: ${rows[0].language}`);
  console.log(`  id:       ${rows[0].id}`);
  console.log(`\nLog in with this username and the password you provided.`);
} finally {
  await client.end();
}
