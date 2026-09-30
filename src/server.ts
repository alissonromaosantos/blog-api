import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { createDatabase } from "./infrastructure/database/connection.js";

const env = loadEnv();
const logger = createLogger(env);
const { db, pool } = createDatabase(env.DATABASE_URL);
const app = createApp({ env, database: db, logger });
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Blog API server started");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close((error) => {
      if (error) logger.error({ err: error }, "HTTP server shutdown failed");
      pool.end().finally(() => process.exit(error ? 1 : 0));
    });
  });
}
