import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./infrastructure/database/connection.js";

const env = loadEnv();
const connectionString = env.NODE_ENV === "test" ? env.TEST_DATABASE_URL : env.DATABASE_URL;
const { db, pool } = createDatabase(connectionString);

try {
  await migrate(db, { migrationsFolder: "./src/drizzle" });
} finally {
  await pool.end();
}
