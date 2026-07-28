// Runs one SQL file against DATABASE_URL, inside a transaction.
//
// Deliberately manual: schema changes are applied by running this on purpose,
// never automatically as part of a deploy. If the file errors, the transaction
// rolls back and the database is left untouched.
//
//   node scripts/run-sql.mjs scripts/sql/001-add-recording-allowance.sql

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  const env = readFileSync(join(here, "..", ".env.local"), "utf8");
  const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
}

const sql = readFileSync(sqlPath, "utf8");
const host = new URL(process.env.DATABASE_URL).host;

console.log(`Database: ${host}`);
console.log(`Applying: ${sqlPath}\n${"-".repeat(50)}\n${sql}${"-".repeat(50)}`);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("\nApplied and committed.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error(`\nFailed — rolled back, database unchanged.\n${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
