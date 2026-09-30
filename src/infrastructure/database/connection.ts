import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(connectionString: string): {
  db: Database;
  pool: Pool;
} {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return { db: drizzle(pool, { schema }), pool };
}
