import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Default of 10 is too low for concurrent session processing (each in-flight
// recording holds a connection across several sequential queries). Supabase's
// transaction pooler (port 6543) multiplexes these cheaply, so this can be
// raised well past what a direct Postgres connection would tolerate — but the
// number must still be validated against the Supabase plan's pooler client
// limit during load testing, not just raised blindly.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 30),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
