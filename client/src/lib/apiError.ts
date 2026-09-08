export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function parseApiErrorBody(status: number, text: string): ApiError {
  const fallback = text.trim() || `Request failed (${status})`;
  try {
    const body = JSON.parse(text) as { message?: string; code?: string };
    const message = body.message?.trim() || fallback;
    return new ApiError(status, message, body.code);
  } catch {
    return new ApiError(status, fallback);
  }
}

export function describeApiError(error: unknown, t: Translate): string {
  if (error instanceof ApiError && error.code) {
    const key = `errors.${error.code}`;
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return t("common.error");
}
