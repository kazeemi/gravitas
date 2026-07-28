// Marks an account as email-verified and grants admin access.
//
// Used to bootstrap the first admin, and to unblock a real account when the
// verification email could not be delivered.
//
//   node scripts/grant-admin.mjs <email>

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;

const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const url = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

const target = (process.argv[2] || "").toLowerCase();
if (!target) {
  console.error("Usage: node scripts/grant-admin.mjs <email>");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows } = await client.query(
    `UPDATE users
        SET email_verified = true,
            is_admin = true,
            email_verification_token = NULL,
            email_verification_expires_at = NULL
      WHERE email = $1
      RETURNING email, name, email_verified, is_admin, recording_seconds_allowance`,
    [target]
  );

  if (rows.length === 0) {
    console.error(`No account found for ${target}`);
    process.exitCode = 1;
  } else {
    const u = rows[0];
    console.log(`Updated ${u.email}:`);
    console.log(`  email_verified: ${u.email_verified}`);
    console.log(`  is_admin:       ${u.is_admin}`);
    console.log(`  allowance:      ${Math.round(u.recording_seconds_allowance / 60)} min`);
    console.log(`\nYou can now sign in with the password you chose, and reach /admin.`);
  }
} finally {
  await client.end();
}
