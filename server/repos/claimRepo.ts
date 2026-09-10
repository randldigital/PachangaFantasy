import { playerClaimRequests, players, type PlayerClaimRequest } from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { contextOf, type ContextRef } from "@shared/domain/context";

/** Restricts a claim join to the Players of one League or one Club. */
function contextFilter(ref: ContextRef) {
  return contextOf(ref) === "league"
    ? eq(players.leagueId, ref.leagueId!)
    : eq(players.clubId, ref.clubId!);
}

export async function getClaimRequest(id: number): Promise<PlayerClaimRequest | undefined> {
  const [request] = await db
    .select()
    .from(playerClaimRequests)
    .where(eq(playerClaimRequests.id, id));
  return request || undefined;
}

export async function getPendingClaim(
  playerId: number,
  userId: number,
): Promise<PlayerClaimRequest | undefined> {
  const [request] = await db
    .select()
    .from(playerClaimRequests)
    .where(
      and(
        eq(playerClaimRequests.playerId, playerId),
        eq(playerClaimRequests.userId, userId),
        eq(playerClaimRequests.status, "pending"),
      ),
    );
  return request || undefined;
}

/**
 * Pending claims a user holds anywhere in one League or Club. Membership stays blocked
 * while any exist.
 */
export async function getPendingClaimsForUserInContext(
  userId: number,
  ref: ContextRef,
): Promise<PlayerClaimRequest[]> {
  const rows = await db
    .select({ request: playerClaimRequests })
    .from(playerClaimRequests)
    .innerJoin(players, eq(players.id, playerClaimRequests.playerId))
    .where(
      and(
        eq(playerClaimRequests.userId, userId),
        eq(playerClaimRequests.status, "pending"),
        contextFilter(ref),
      ),
    );
  return rows.map((row) => row.request);
}

export async function getPendingClaimsForContext(ref: ContextRef): Promise<PlayerClaimRequest[]> {
  const rows = await db
    .select({ request: playerClaimRequests })
    .from(playerClaimRequests)
    .innerJoin(players, eq(players.id, playerClaimRequests.playerId))
    .where(and(eq(playerClaimRequests.status, "pending"), contextFilter(ref)));
  return rows.map((row) => row.request);
}

/** Idempotent: retrying the same alias while pending returns the original request. */
export async function requestClaim(
  playerId: number,
  userId: number,
): Promise<PlayerClaimRequest> {
  const pending = await getPendingClaim(playerId, userId);
  if (pending) {
    return pending;
  }
  const [created] = await db
    .insert(playerClaimRequests)
    .values({ playerId, userId, status: "pending" })
    .returning();
  return created;
}

export async function resolveClaim(
  id: number,
  status: "accepted" | "rejected",
  resolvedBy: number,
): Promise<PlayerClaimRequest | undefined> {
  const [updated] = await db
    .update(playerClaimRequests)
    .set({ status, resolvedAt: new Date(), resolvedBy })
    .where(eq(playerClaimRequests.id, id))
    .returning();
  return updated || undefined;
}

export async function deleteClaimsByPlayerIds(playerIds: number[]): Promise<void> {
  for (const playerId of playerIds) {
    await db.delete(playerClaimRequests).where(eq(playerClaimRequests.playerId, playerId));
  }
}

/** Drops leftover pending claims when a user leaves or is removed from a context. */
export async function rejectPendingClaimsForUserInContext(
  userId: number,
  ref: ContextRef,
  resolvedBy: number,
): Promise<void> {
  const pending = await getPendingClaimsForUserInContext(userId, ref);
  for (const request of pending) {
    await resolveClaim(request.id, "rejected", resolvedBy);
  }
}
