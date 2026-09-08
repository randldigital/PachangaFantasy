import { lineups, type Lineup, type InsertLineup } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

export async function getLineup(
  matchId: number,
  userId: number,
): Promise<Lineup | undefined> {
  const [lineup] = await db
    .select()
    .from(lineups)
    .where(and(eq(lineups.matchId, matchId), eq(lineups.userId, userId)));
  return lineup || undefined;
}

export async function getLineupsForMatch(matchId: number): Promise<Lineup[]> {
  return await db.select().from(lineups).where(eq(lineups.matchId, matchId));
}

export async function createLineup(lineup: InsertLineup): Promise<Lineup> {
  const [created] = await db.insert(lineups).values(lineup).returning();
  return created;
}

export async function updateLineup(
  id: number,
  updates: Partial<Lineup>,
): Promise<Lineup | undefined> {
  const [lineup] = await db
    .update(lineups)
    .set(updates)
    .where(eq(lineups.id, id))
    .returning();
  return lineup || undefined;
}
