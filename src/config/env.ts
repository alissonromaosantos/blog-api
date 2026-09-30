import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce
    .number({ error: "Invalid port number" })
    .int({ error: "Port must be an integer" })
    .positive({ error: "Port must be a positive number" })
    .default(3333),
  DATABASE_URL: z
    .string({ error: "Invalid database URL" })
    .url({ error: "Invalid database URL" })
    .startsWith("postgres"),
  TEST_DATABASE_URL: z
    .string({ error: "Invalid test database URL" })
    .url({ error: "Invalid test database URL" })
    .startsWith("postgres"),
  CORS_ORIGIN: z.string({ error: "Invalid CORS origin" }).default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Environment = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}
