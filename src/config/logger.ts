import pino from "pino";
import type { Environment } from "./env.js";

export function createLogger(env: Environment): pino.Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "password",
        "token",
        "tokenHash",
        "*.password",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
    base: { environment: env.NODE_ENV },
  });
}
