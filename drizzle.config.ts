import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.NODE_ENV === "test" ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/infrastructure/database/schema.ts",
  out: "./src/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgresql://blog:blog@localhost:5432/blog",
  },
});
