import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  createOpenMatch,
  joinAllMatches,
  listPlayers,
  startMatch,
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { lineups, statReports } from "@shared/schema";

describe("full loop", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("register → league → valuation → match → lineup → stats → score → both leaderboards", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const players = await listPlayers(app, owner.token, league.id);
    const ids = players.map((player) => player.id);
    expect(ids).toHaveLength(5);

    const opened = await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set(auth(owner.token));
    expect(opened.status).toBe(200);

    for (const user of users) {
      const ranked = await request(app)
        .post(`/api/tierlist/${league.id}`)
        .set(auth(user.token))
        .send({
          playerTiers: ids.map((playerId) => ({ playerId, tier: "B" })),
          submitted: true,
        });
      expect(ranked.status).toBe(200);
    }

    const closed = await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set(auth(owner.token));
    expect(closed.status).toBe(200);

    const valued = await listPlayers(app, owner.token, league.id);
    expect(valued.every((player) => player.marketValue === 18)).toBe(true);

    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    expect(matchResponse.status).toBe(200);
    const match = matchResponse.body;
    await joinAllMatches(app, match.id, users);

    const ownerPlayer = valued.find((player) => player.userId === owner.user.id)!;
    for (const user of users) {
      const saved = await request(app)
        .post(`/api/matches/${match.id}/lineup`)
        .set(auth(user.token))
        .send({ playerIds: ids, captainId: ownerPlayer.id });
      expect(saved.status).toBe(200);
      expect(saved.body.totalCost).toBe(90);
    }

    expect((await startMatch(app, owner.token, match.id)).status).toBe(200);
    const ended = await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ finalScore: 2 });
    expect(ended.status).toBe(200);

    const statsByUserId: Record<number, { goals: number; assists: number }> = {
      [owner.user.id]: { goals: 2, assists: 1 },
      [users[1].user.id]: { goals: 0, assists: 0 },
      [users[2].user.id]: { goals: 0, assists: 0 },
      [users[3].user.id]: { goals: 0, assists: 0 },
      [users[4].user.id]: { goals: 0, assists: 0 },
    };
    for (const user of users) {
      const submitted = await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(user.token))
        .send(statsByUserId[user.user.id]);
      expect(submitted.status).toBe(200);
    }

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    expect(scored.body.playerPoints.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).points).toBe(8);
    expect(
      scored.body.managerPoints.every((row: { points: number; lineupStatus: string }) => row.points === 16 && row.lineupStatus === "ok"),
    ).toBe(true);

    const playersBoard = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(playersBoard.body.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).totalPoints).toBe(8);
    expect(playersBoard.body.filter((row: { totalPoints: number }) => row.totalPoints === 0)).toHaveLength(4);

    const managersBoard = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set(auth(owner.token));
    expect(managersBoard.body).toHaveLength(5);
    expect(managersBoard.body.every((row: { totalPoints: number }) => row.totalPoints === 16)).toBe(true);

    await db.update(statReports).set({ goals: 9 }).where(eq(statReports.matchId, match.id));
    await db.update(lineups).set({ captainId: ids[1] }).where(eq(lineups.matchId, match.id));

    const again = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(again.body.playerPoints.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).points).toBe(8);
    expect(again.body.managerPoints[0].points).toBe(16);

    const frozenPlayers = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(frozenPlayers.body.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).totalPoints).toBe(8);
    const frozenManagers = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set(auth(owner.token));
    expect(frozenManagers.body.every((row: { totalPoints: number }) => row.totalPoints === 16)).toBe(true);
  });
});
