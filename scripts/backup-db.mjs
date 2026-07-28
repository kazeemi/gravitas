// Logical backup of every public table to a single JSON file.
//
// Read-only against the database. Writes one file to the path given as the
// first argument. Contains real personal data (emails, transcripts) — keep it
// outside the repo and treat it as confidential.
//
//   node scripts/backup-db.mjs /path/to/backup.json

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;

const outPath = process.argv[2];
if (!outPath) {
  console.error("Usage: node scripts/backup-db.mjs <output.json>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  const env = readFileSync(join(here, "..", ".env.local"), "utf8");
  const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: tables } = await client.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`
);

const dump = { takenAt: new Date().toISOString(), tables: {} };
for (const { table_name } of tables) {
  // Table names come from information_schema, not user input, but quote anyway.
  const { rows } = await client.query(`SELECT * FROM "${table_name}"`);
  dump.tables[table_name] = rows;
  console.log(`${table_name}: ${rows.length} row(s)`);
}
await client.end();

writeFileSync(outPath, JSON.stringify(dump, null, 2));
console.log(`\nWrote ${outPath}`);
