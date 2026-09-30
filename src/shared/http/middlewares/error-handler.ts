import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError } from "../../errors/app-error.js";

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    const requestId = request.requestId;
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid JSON request body",
          requestId,
        },
      });
      return;
    }
    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...("details" in error ? { details: error.details } : {}),
          requestId,
        },
      });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
          requestId,
        },
      });
      return;
    }

    logger.error(
      { err: error, requestId, method: request.method, path: request.path },
      "Unhandled request error",
    );
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId,
      },
    });
  };
}
