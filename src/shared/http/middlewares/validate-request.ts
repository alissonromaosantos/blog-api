import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../../errors/app-error.js";

interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (request, _response, next) => {
    const validated: NonNullable<typeof request.validated> = {};
    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(request[key]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          path: [key, ...issue.path].join("."),
          message: issue.message,
        }));
        next(
          Object.assign(new AppError(400, "VALIDATION_ERROR", "Invalid request data"), { details }),
        );
        return;
      }
      validated[key] = result.data;
    }
    request.validated = validated;
    next();
  };
}
