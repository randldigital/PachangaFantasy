import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  createLeagueWithMembers,
  createOpenMatch,
  startMatch,
  submitAllRatings,
  expectedPlayerMatchRating,
} from "../helpers/fixtures";
import { managerMatchPoints } from "@shared/domain/scoring";
import { db } from "../../server/db";
import { lineups, statReports } from "@shared/schema";

async function joinAll(
  app: ReturnType<typeof createApp>,
  matchId: number,
  users: { token: string }[],
) {
  for (const user of users) {
    const joined = await request(app)
      .post(`/api/matches/${matchId}/join`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(joined.status).toBe(200);
  }
}

async function leaguePlayers(
  app: ReturnType<typeof createApp>,
  token: string,
  leagueId: number,
) {
  const response = await request(app)
    .get(`/api/players/${leagueId}`)
    .set("Authorization", `Bearer ${token}`);
  return response.body as { id: number; userId: number | null; name: string; isExternal?: boolean }[];
}

describe("phase 6 scoring and leaderboards", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("scores player and manager points separately, snapshots them, and lists both boards", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;
    await joinAll(app, match.id, users);

    const players = await leaguePlayers(app, owner.token, league.id);
    const ids = players.map((player) => player.id);
    const ownerPlayer = players.find((player) => player.userId === owner.user.id)!;
    const eightPointPlayer = ownerPlayer.id;

    await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: ids, captainId: eightPointPlayer });

    await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${users[1].token}`)
      .send({ playerIds: ids, captainId: players.find((player) => player.userId === users[2].user.id)!.id });

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ teamAGoals: 5, teamBGoals: 0 });

    const statsByUserId: Record<number, { goals: number; assists: number }> = {
      [owner.user.id]: { goals: 2, assists: 1 },
      [users[1].user.id]: { goals: 1, assists: 0 },
      [users[2].user.id]: { goals: 0, assists: 0 },
      [users[3].user.id]: { goals: 0, assists: 1 },
      [users[4].user.id]: { goals: 2, assists: 0 },
    };

    for (const user of users) {
      const submitted = await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set("Authorization", `Bearer ${user.token}`)
        .send(statsByUserId[user.user.id]);
      expect(submitted.status).toBe(200);
    }

    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(scored.status).toBe(200);
    expect(scored.body.playerPoints).toHaveLength(5);

    const ownerPlayerRow = scored.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === eightPointPlayer,
    );
    const pointsByPlayer = Object.fromEntries(
      scored.body.playerPoints.map((row: { playerId: number; points: number }) => [row.playerId, row.points]),
    );
    expect(ownerPlayerRow.points).toBe(
      await expectedPlayerMatchRating(match.id, eightPointPlayer, { goals: 2, assists: 1 }),
    );

    const ownerManager = scored.body.managerPoints.find(
      (row: { userId: number }) => row.userId === owner.user.id,
    );
    expect(ownerManager.points).toBe(
      managerMatchPoints({ playerIds: ids, captainId: eightPointPlayer, playerPointsById: pointsByPlayer }),
    );
    expect(ownerManager.lineupStatus).toBe("ok");

    const secondManager = scored.body.managerPoints.find(
      (row: { userId: number }) => row.userId === users[1].user.id,
    );
    expect(secondManager.points).toBe(
      managerMatchPoints({
        playerIds: ids,
        captainId: players.find((player) => player.userId === users[2].user.id)!.id,
        playerPointsById: pointsByPlayer,
      }),
    );

    const missing = scored.body.managerPoints.find(
      (row: { userId: number }) => row.userId === users[2].user.id,
    );
    expect(missing.points).toBe(0);
    expect(missing.lineupStatus).toBe("missing");

    const again = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(again.body.managerPoints.find((row: { userId: number }) => row.userId === owner.user.id).points).toBe(ownerManager.points);

    await db.update(statReports).set({ goals: 9 }).where(eq(statReports.matchId, match.id));

    const playersBoard = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(playersBoard.status).toBe(200);
    const ownerBoard = playersBoard.body.find((row: { userId: number }) => row.userId === owner.user.id);
    expect(ownerBoard.totalPoints).toBe(ownerPlayerRow.points);
    expect(ownerBoard.goals).toBe(2);

    const managersBoard = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(managersBoard.body.find((row: { userId: number }) => row.userId === owner.user.id).totalPoints).toBe(ownerManager.points);
    expect(managersBoard.body.find((row: { userId: number }) => row.userId === users[2].user.id).totalPoints).toBe(0);
  });

  it("zeros an invalid stored lineup instead of inventing a score, and lists external players", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;
    await joinAll(app, match.id, users);

    const external = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "El Vecino", emoji: "🧢", isExternal: true });
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: [external.body.id] });

    const players = await leaguePlayers(app, owner.token, league.id);
    const registeredIds = players.filter((player) => player.userId).map((player) => player.id);

    await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: registeredIds, captainId: registeredIds[0] });

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ teamAGoals: 0, teamBGoals: 0 });

    for (const user of users) {
      await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ goals: 0, assists: 0 });
    }
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerId: external.body.id, goals: 0, assists: 0 });

    await submitAllRatings(app, match.id, users);

    await db
      .update(lineups)
      .set({ playerIds: registeredIds.slice(0, 4) })
      .where(eq(lineups.matchId, match.id));

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(scored.status).toBe(200);
    expect(scored.body.lineupIssues[0].userId).toBe(owner.user.id);
    expect(scored.body.managerPoints[0].points).toBe(0);
    expect(scored.body.managerPoints[0].lineupStatus).toBe("invalid");

    const playersBoard = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(playersBoard.body.some((row: { playerId: number }) => row.playerId === external.body.id)).toBe(true);
  });
});
