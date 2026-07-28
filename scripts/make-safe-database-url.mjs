// Rebuilds DATABASE_URL with the password percent-encoded, so the value can be
// pasted into a web form (Railway's variable editor) without being mangled.
//
// A password containing % & * is valid in the file but hazardous in a URL: %
// starts an escape sequence and & separates query parameters.
//
// Verifies the rebuilt URL actually connects, then writes it to the output path.
// The password is never printed.
//
//   node scripts/make-safe-database-url.mjs <output-file>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;

const outPath = process.argv[2];
if (!outPath) {
  console.error("Usage: node scripts/make-safe-database-url.mjs <output-file>");
  process.exit(1);
}

const env = readFileSync(join(here, "..", ".env.local"), "utf8");
const raw = env
  .match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

const u = new URL(raw);
const encoded = encodeURIComponent(u.password);

// No sslmode parameter: pg treats sslmode=require as verify-full, which fails
// against Supabase's certificate chain. The app's pool passes no ssl options
// either, so leave the URL bare and match it exactly.
const safe = `${u.protocol}//${u.username}:${encoded}@${u.hostname}:${u.port}${u.pathname}`;

// Only % and & actually break pasting: % starts an escape, & splits parameters.
// encodeURIComponent leaves * alone, which is fine in userinfo.
const stillRisky = /[&%]/.test(encoded.replace(/%[0-9A-Fa-f]{2}/g, ""));

console.log(`Password: ${u.password.length} chars -> ${encoded.length} chars once encoded`);
console.log(`Unescaped % or & remaining: ${stillRisky ? "YES" : "none — safe to paste"}`);

// Exactly how artifacts/api-server connects: connection string only, no ssl opts.
const client = new pg.Client({ connectionString: safe });

try {
  await client.connect();
  const { rows } = await client.query("SELECT count(*)::int AS n FROM users");
  console.log(`\nConnection test: SUCCESS — users table reachable (${rows[0].n} rows)`);
  await client.end();
  writeFileSync(outPath, safe + "\n");
  console.log(`Written to: ${outPath}`);
} catch (err) {
  console.error(`\nConnection test: FAILED — ${err.message}`);
  console.error("Not writing the file, since the value does not work.");
  process.exitCode = 1;
}
