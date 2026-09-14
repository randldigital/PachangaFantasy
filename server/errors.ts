export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_NOT_VERIFIED"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "INVALID_VERIFICATION_TOKEN"
  | "GOOGLE_NOT_CONFIGURED"
  | "PAYMENTS_DISABLED"
  | "PAYMENTS_PROVIDER_NOT_CONFIGURED"
  | "MEMBERSHIP_CLOSED"
  | "ENTITLEMENT_REQUIRED"
  | "ANALYTICS_LOCKED";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = "Access token required") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Not authorized") {
  return new AppError(403, "FORBIDDEN", message);
}

export function notFound(message = "Not found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function conflict(message: string) {
  return new AppError(409, "CONFLICT", message);
}

export function validationError(message: string, details?: unknown) {
  return new AppError(400, "VALIDATION_ERROR", message, details);
}

export function toErrorBody(error: AppError) {
  return {
    message: error.message,
    code: error.code,
    ...(error.details !== undefined ? { errors: error.details } : {}),
  };
}
