// Read-only schema drift check.
//
// Compares the columns that exist in the live database against the columns
// defined in lib/db/src/schema. Reports what a `drizzle-kit push` would ADD
// and — critically — what it would DROP.
//
// Runs SELECTs against information_schema only. It never reads user data and
// never writes.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// pg lives in the lib/db workspace package, not the repo root.
const pg = (
  await import(pathToFileURL(join(here, "..", "lib", "db", "node_modules", "pg", "lib", "index.js")).href)
).default;
const schemaDir = join(here, "..", "lib", "db", "src", "schema");

// Load DATABASE_URL from .env.local without pulling in a dep.
if (!process.env.DATABASE_URL) {
  const env = readFileSync(join(here, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  }
}

// Parse `pgTable("name", { field: type("column_name")... })` out of the schema
// files. Good enough to enumerate table + column names.
function parseSchema() {
  const tables = new Map();
  for (const file of readdirSync(schemaDir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(schemaDir, file), "utf8");
    const tableRe = /pgTable\(\s*["']([a-z_]+)["']\s*,\s*\{/g;
    let t;
    while ((t = tableRe.exec(src))) {
      const tableName = t[1];
      // Walk braces from the opening { to find the table body.
      let depth = 1;
      let i = tableRe.lastIndex;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      }
      const body = src.slice(tableRe.lastIndex, i - 1);
      const cols = new Set();
      // Only the first call in each property assignment names the column:
      //   fieldName: varchar("column_name", ...).notNull().default("seated")
      // Anchoring to `field:` avoids picking up default()/references() arguments.
      const colRe = /(?:^|\n)\s*\w+\s*:\s*\w+\s*\(\s*["']([a-z0-9_]+)["']/g;
      let c;
      while ((c = colRe.exec(body))) cols.add(c[1]);
      tables.set(tableName, cols);
    }
  }
  return tables;
}

const declared = parseSchema();
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows } = await client.query(
  `SELECT table_name, column_name
     FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position`
);
await client.end();

const live = new Map();
for (const r of rows) {
  if (!live.has(r.table_name)) live.set(r.table_name, new Set());
  live.get(r.table_name).add(r.column_name);
}

let willAdd = 0;
let willDrop = 0;

console.log(`Live tables: ${[...live.keys()].join(", ") || "(none)"}\n`);

for (const [table, cols] of declared) {
  const liveCols = live.get(table);
  if (!liveCols) {
    console.log(`+ TABLE ${table} — would be CREATED (${cols.size} columns)`);
    willAdd += cols.size;
    continue;
  }
  const toAdd = [...cols].filter((c) => !liveCols.has(c));
  const toDrop = [...liveCols].filter((c) => !cols.has(c));
  if (toAdd.length || toDrop.length) {
    console.log(`TABLE ${table}`);
    for (const c of toAdd) console.log(`  + ADD    ${c}`);
    for (const c of toDrop) console.log(`  - DROP   ${c}   <-- DATA LOSS`);
    willAdd += toAdd.length;
    willDrop += toDrop.length;
  }
}

for (const table of live.keys()) {
  if (!declared.has(table)) {
    console.log(`! TABLE ${table} exists live but is not in the schema files`);
  }
}

console.log(
  `\nSummary: ${willAdd} column(s) to add, ${willDrop} column(s) that would be dropped.`
);
console.log(
  willDrop === 0
    ? "SAFE: additive only — no column would be dropped."
    : "UNSAFE: deploying would drop the columns marked above."
);
