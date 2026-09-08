import { players, leagues, type Player, type InsertPlayer } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { uniqueLeaguePlayerName } from "@shared/domain/players";
import { DEFAULT_MARKET_VALUE } from "@shared/domain/valuation";

export async function getPlayer(id: number): Promise<Player | undefined> {
  const [player] = await db.select().from(players).where(eq(players.id, id));
  return player || undefined;
}

export async function getPlayersByLeague(leagueId: number): Promise<Player[]> {
  return await db.select().from(players).where(eq(players.leagueId, leagueId));
}

export async function createPlayer(
  player: InsertPlayer & {
    leagueId: number;
    createdBy?: number;
    userId?: number;
    isExternal?: boolean;
  },
): Promise<Player> {
  const existing = await getPlayersByLeague(player.leagueId);
  const name = uniqueLeaguePlayerName(
    player.name,
    existing.map((item) => item.name),
  );

  const [league] = await db
    .select({ status: leagues.status })
    .from(leagues)
    .where(eq(leagues.id, player.leagueId));
  const marketValue = league?.status === "closed" ? DEFAULT_MARKET_VALUE : 0;

  const [newPlayer] = await db
    .insert(players)
    .values({
      name,
      emoji: player.emoji,
      leagueId: player.leagueId,
      createdBy: player.createdBy,
      userId: player.userId,
      isExternal: player.isExternal ?? false,
      marketValue,
    })
    .returning();
  return newPlayer;
}

export async function updatePlayer(
  id: number,
  updates: Partial<Player>,
): Promise<Player | undefined> {
  const [updated] = await db
    .update(players)
    .set(updates)
    .where(eq(players.id, id))
    .returning();
  return updated || undefined;
}

export async function checkUserAsPlayer(
  userId: number,
  leagueId: number,
): Promise<Player | undefined> {
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.leagueId, leagueId)));
  return player || undefined;
}

export async function claimUnlinkedOrCreatePlayer(input: {
  leagueId: number;
  userId: number;
  username: string;
}): Promise<{ player: Player; claimed: boolean }> {
  const existing = await checkUserAsPlayer(input.userId, input.leagueId);
  if (existing) {
    return { player: existing, claimed: false };
  }

  const roster = await getPlayersByLeague(input.leagueId);
  const unlinked = roster.find(
    (player) => player.name.toLowerCase() === input.username.toLowerCase() && !player.userId,
  );
  if (unlinked) {
    const claimed = await updatePlayer(unlinked.id, { userId: input.userId, isExternal: false });
    if (!claimed) {
      throw new Error("Failed to claim unlinked player");
    }
    return { player: claimed, claimed: true };
  }

  const created = await createPlayer({
    name: input.username,
    leagueId: input.leagueId,
    userId: input.userId,
    createdBy: input.userId,
  });
  return { player: created, claimed: false };
}

export async function deletePlayersByLeague(leagueId: number): Promise<void> {
  await db.delete(players).where(eq(players.leagueId, leagueId));
}
