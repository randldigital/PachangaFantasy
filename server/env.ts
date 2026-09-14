import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;

function readFlag(name: string): boolean {
  const value = (process.env[name] ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/** Optional settings are read live so tests can toggle flags without re-importing. */
export function publicUrl(): string {
  return (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
}

export function storageDir(): string {
  const value = (process.env.STORAGE_DIR ?? "").trim();
  return value || "uploads";
}

export function smtpHost(): string {
  return (process.env.SMTP_HOST ?? "").trim();
}

export function smtpPort(): number {
  const raw = (process.env.SMTP_PORT ?? "").trim();
  if (!raw) return 587;
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : 587;
}

export function smtpUser(): string {
  return process.env.SMTP_USER ?? "";
}

export function smtpPass(): string {
  return process.env.SMTP_PASS ?? "";
}

export function smtpFrom(): string {
  const from = (process.env.SMTP_FROM ?? "").trim();
  return from || "Pachanga <noreply@localhost>";
}

export function googleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID ?? "").trim();
}

export function googleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
}

export function googleConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

export function paymentsEnabled(): boolean {
  return readFlag("PAYMENTS_ENABLED");
}

export function adsEnabled(): boolean {
  return readFlag("ADS_ENABLED");
}

export function adsTest(): boolean {
  return readFlag("ADS_TEST");
}

export function adsenseClient(): string {
  const raw = (process.env.ADSENSE_CLIENT ?? "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("ca-pub-")) {
    return raw;
  }
  if (raw.startsWith("pub-")) {
    return `ca-${raw}`;
  }
  return raw;
}

export function adsenseSlotOverview(): string {
  return (process.env.ADSENSE_SLOT_OVERVIEW ?? "").trim();
}

export function adsenseSlotHub(): string {
  return (process.env.ADSENSE_SLOT_HUB ?? "").trim();
}

export function analyticsPasscode(): string {
  const value = (process.env.ANALYTICS_PASSCODE ?? "").trim();
  return value || "2026";
}

export function defaultPlanCode(): string {
  const value = (process.env.FEATURE_DEFAULT_PLAN ?? "").trim();
  return value || "free";
}

export function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
