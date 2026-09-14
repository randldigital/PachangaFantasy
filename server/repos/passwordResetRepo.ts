import { eq } from "drizzle-orm";
import { passwordResetTokens } from "@shared/schema";
import { db } from "../db";
import { hashToken, newRawToken } from "./tokenCrypto";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function issueResetToken(
  userId: number,
  ttlMs = TOKEN_TTL_MS,
): Promise<string> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  const raw = newRawToken();
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return raw;
}

export async function consumeResetToken(
  rawToken: string,
): Promise<{ userId: number } | null> {
  const hash = hashToken(rawToken);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, hash));
  if (!row) {
    return null;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.id));
    return null;
  }
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, row.userId));
  return { userId: row.userId };
}
