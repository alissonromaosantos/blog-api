export type ErrorCode =
  "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Authentication required"): AppError =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message: string): AppError => new AppError(403, "FORBIDDEN", message);
export const notFound = (message: string): AppError => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string): AppError => new AppError(409, "CONFLICT", message);
