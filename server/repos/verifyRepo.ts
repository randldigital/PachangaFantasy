import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { emailVerificationTokens } from "@shared/schema";
import { db } from "../db";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

export async function issueVerificationToken(userId: number): Promise<string> {
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  const raw = newRawToken();
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return raw;
}

export async function consumeVerificationToken(
  rawToken: string,
): Promise<{ userId: number } | null> {
  const hash = hashToken(rawToken);
  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, hash));
  if (!row) {
    return null;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, row.id));
    return null;
  }
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, row.userId));
  return { userId: row.userId };
}
