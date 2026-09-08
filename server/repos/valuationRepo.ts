import { tierLists, type TierList, type InsertTierList } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import type { PlayerTierPlacement } from "@shared/domain/valuation";

export async function getTierList(
  leagueId: number,
  userId: number,
): Promise<TierList | undefined> {
  const [tierList] = await db
    .select()
    .from(tierLists)
    .where(and(eq(tierLists.leagueId, leagueId), eq(tierLists.userId, userId)));
  return tierList || undefined;
}

export async function getTierListsByLeague(leagueId: number): Promise<TierList[]> {
  return await db.select().from(tierLists).where(eq(tierLists.leagueId, leagueId));
}

export async function getSubmittedTierListsByLeague(leagueId: number): Promise<TierList[]> {
  return await db
    .select()
    .from(tierLists)
    .where(and(eq(tierLists.leagueId, leagueId), eq(tierLists.submitted, true)));
}

export async function createTierList(
  tierList: InsertTierList & { leagueId: number; userId: number },
): Promise<TierList> {
  const insertValues = {
    leagueId: tierList.leagueId,
    userId: tierList.userId,
    playerTiers: tierList.playerTiers as PlayerTierPlacement[],
    submitted: tierList.submitted ?? false,
  };

  const [newTierList] = await db.insert(tierLists).values(insertValues).returning();
  return newTierList;
}

export async function updateTierList(
  id: number,
  updates: Partial<TierList>,
): Promise<TierList | undefined> {
  const [updated] = await db
    .update(tierLists)
    .set(updates)
    .where(eq(tierLists.id, id))
    .returning();
  return updated || undefined;
}

export async function deleteTierListsByLeague(leagueId: number): Promise<void> {
  await db.delete(tierLists).where(eq(tierLists.leagueId, leagueId));
}
