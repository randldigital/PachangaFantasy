import { collections, leagues, type League, type InsertLeague } from "@shared/schema";
import { db } from "../db";
import { eq, or, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { buildInviteCode, INVITE_ALPHABET, INVITE_BODY_LENGTH } from "@shared/domain/inviteCodes";
import * as billingRepo from "./billingRepo";
import * as matchRepo from "./matchRepo";
import * as valuationRepo from "./valuationRepo";
import * as playerRepo from "./playerRepo";

const inviteBody = customAlphabet(INVITE_ALPHABET, INVITE_BODY_LENGTH);

export async function getLeague(id: number): Promise<League | undefined> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
  return league || undefined;
}

export async function getLeagueByInviteCode(inviteCode: string): Promise<League | undefined> {
  const [league] = await db.select().from(leagues).where(eq(leagues.inviteCode, inviteCode));
  return league || undefined;
}

export async function createLeague(league: InsertLeague, createdBy: number): Promise<League> {
  const [newLeague] = await db
    .insert(leagues)
    .values({
      name: league.name,
      description: league.description,
      inviteCode: buildInviteCode("league", inviteBody()),
      createdBy,
      participants: [createdBy],
      status: "open",
      createdAt: new Date(),
    })
    .returning();
  await billingRepo.ensureBillingAccount({ type: "league", id: newLeague.id });
  return newLeague;
}

export async function updateLeague(
  id: number,
  updates: Partial<League>,
): Promise<League | undefined> {
  const [updated] = await db
    .update(leagues)
    .set(updates)
    .where(eq(leagues.id, id))
    .returning();
  return updated || undefined;
}

export async function deleteLeague(id: number): Promise<void> {
  const leagueMatches = await matchRepo.getMatchesByLeague(id);
  for (const match of leagueMatches) {
    await matchRepo.deleteMatch(match.id);
  }
  await valuationRepo.deleteTierListsByLeague(id);
  await playerRepo.deletePlayersByLeague(id);
  await billingRepo.deleteAccount({ type: "league", id });
  await db.delete(leagues).where(eq(leagues.id, id));
}

export async function getUserLeagues(userId: number): Promise<Array<League & { hasCollection: boolean }>> {
  const rows = await db
    .select({ league: leagues, collectionId: collections.id })
    .from(leagues)
    .leftJoin(collections, eq(collections.leagueId, leagues.id))
    .where(
      or(
        eq(leagues.createdBy, userId),
        sql`${leagues.participants} @> ${JSON.stringify([userId])}`,
      ),
    );
  return rows.map((row) => ({ ...row.league, hasCollection: row.collectionId != null }));
}
