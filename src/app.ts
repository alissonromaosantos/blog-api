import { randomUUID } from "crypto";
import cors from "cors";
import express, { type Express } from "express";
import type { Logger } from "pino";
import { createCorsOptions } from "./config/cors.js";
import { createLogger } from "./config/logger.js";
import { loadEnv, type Environment } from "./config/env.js";
import { createDatabase, type Database } from "./infrastructure/database/connection.js";
import { DrizzleBlogRepository } from "./infrastructure/repositories/drizzle-blog.repository.js";
import { createAuthRouter } from "./modules/auth/routes.js";
import {
  AuthUseCases,
  createSessionTokenService,
} from "./modules/auth/use-cases/auth.use-cases.js";
import { createPostRouter } from "./modules/posts/routes.js";
import { PostUseCases } from "./modules/posts/use-cases/post.use-cases.js";
import { createErrorHandler, notFoundHandler } from "./shared/http/middlewares/error-handler.js";

export interface AppOptions {
  env?: Environment;
  database?: Database;
  logger?: Logger;
}

export function createApp(options: AppOptions = {}): Express {
  const env = options.env ?? loadEnv();
  const database = options.database ?? createDatabase(env.DATABASE_URL).db;
  const logger = options.logger ?? createLogger(env);
  const repository = new DrizzleBlogRepository(database);
  const auth = new AuthUseCases(
    repository,
    {
      async hash(value) {
        const bcrypt = await import("bcryptjs");
        return bcrypt.hash(value, 13);
      },
      async compare(value, hashedValue) {
        const bcrypt = await import("bcryptjs");
        return bcrypt.compare(value, hashedValue);
      },
    },
    createSessionTokenService(),
  );
  const posts = new PostUseCases(repository);
  const app = express();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const requestId = request.get("x-request-id")?.slice(0, 128) || randomUUID();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    const startedAt = process.hrtime.bigint();
    response.on("finish", () => {
      logger.info(
        {
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        },
        "HTTP request completed",
      );
    });
    next();
  });
  app.use(cors(createCorsOptions(env)));
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_request, response) => response.status(200).json({ status: "ok" }));
  app.use("/api/auth", createAuthRouter(auth));
  app.use("/api/posts", createPostRouter(auth, posts));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
