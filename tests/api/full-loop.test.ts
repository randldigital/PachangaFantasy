import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  createOpenMatch,
  expectedPlayerMatchRating,
  joinAllMatches,
  listPlayers,
  fillMissingStats,
  startMatch,
  submitAllRatings,
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
      .send({ teamAGoals: 2, teamBGoals: 0 });
    await fillMissingStats(app, owner.token, match.id);
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

    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    const ownerRating = await expectedPlayerMatchRating(match.id, ownerPlayer.id, { goals: 2, assists: 1 });
    expect(scored.body.playerPoints.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).points).toBe(ownerRating);
    const managerTotal = scored.body.managerPoints[0].points;
    expect(
      scored.body.managerPoints.every((row: { points: number; lineupStatus: string }) => row.points === managerTotal && row.lineupStatus === "ok"),
    ).toBe(true);

    const playersBoard = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(playersBoard.body.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).totalPoints).toBe(ownerRating);

    const managersBoard = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set(auth(owner.token));
    expect(managersBoard.body).toHaveLength(5);
    expect(managersBoard.body.every((row: { totalPoints: number }) => row.totalPoints === managerTotal)).toBe(true);

    await db.update(statReports).set({ goals: 9 }).where(eq(statReports.matchId, match.id));
    await db.update(lineups).set({ captainId: ids[1] }).where(eq(lineups.matchId, match.id));

    const again = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(again.body.playerPoints.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).points).toBe(ownerRating);
    expect(again.body.managerPoints[0].points).toBe(managerTotal);

    const frozenPlayers = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(frozenPlayers.body.find((row: { playerId: number }) => row.playerId === ownerPlayer.id).totalPoints).toBe(ownerRating);
    const frozenManagers = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set(auth(owner.token));
    expect(frozenManagers.body.every((row: { totalPoints: number }) => row.totalPoints === managerTotal)).toBe(true);
  });

  it("runs the same loop on a 7-a-side match, with capacity 14 and a five-player lineup", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 14);
    const ids = (await listPlayers(app, owner.token, league.id)).map((player) => player.id);
    expect(ids).toHaveLength(14);

    const matchResponse = await createOpenMatch(app, owner.token, league.id, 7);
    expect(matchResponse.status).toBe(200);
    const match = matchResponse.body;
    expect(match.sideSize).toBe(7);
    await joinAllMatches(app, match.id, users);

    const external = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(owner.token))
      .send({ name: "El Quinceavo", isExternal: true });
    const overCapacity = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [external.body.id] });
    expect(overCapacity.status).toBe(400);
    expect(overCapacity.body.code).toBe("MATCH_FULL");
    expect(overCapacity.body.capacity).toBe(14);

    const ownerPlayer = (await listPlayers(app, owner.token, league.id)).find(
      (player) => player.userId === owner.user.id,
    )!;
    const lineupIds = ids.slice(0, 5);
    const saved = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: lineupIds, captainId: lineupIds[0] });
    expect(saved.status).toBe(200);
    expect(saved.body.playerIds).toHaveLength(5);

    const lopsided = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: ids.slice(0, 8), teamB: ids.slice(8) });
    expect(lopsided.status).toBe(400);
    expect(lopsided.body.code).toBe("SIDE_OVER_CAPACITY");

    const tooEarly = await request(app)
      .post(`/api/matches/${match.id}/start`)
      .set(auth(owner.token));
    expect(tooEarly.status).toBe(400);
    expect(tooEarly.body.code).toBe("TEAMS_REQUIRED");

    expect((await startMatch(app, owner.token, match.id)).status).toBe(200);
    const detail = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    expect(detail.body.sideSize).toBe(7);
    expect(detail.body.matchTeams.teamA).toHaveLength(7);
    expect(detail.body.matchTeams.teamB).toHaveLength(7);

    const ended = await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 3, teamBGoals: 1 });
    expect(ended.status).toBe(200);

    for (const user of users) {
      const submitted = await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(user.token))
        .send(user.user.id === owner.user.id ? { goals: 4, assists: 1 } : { goals: 0, assists: 0 });
      expect(submitted.status).toBe(200);
    }

    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    expect(scored.body.playerPoints).toHaveLength(14);
    const ownerRating = await expectedPlayerMatchRating(match.id, ownerPlayer.id, {
      goals: 4,
      assists: 1,
    });
    expect(
      scored.body.playerPoints.find((row: { playerId: number }) => row.playerId === ownerPlayer.id)
        .points,
    ).toBe(ownerRating);

    const playersBoard = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(
      playersBoard.body.find((row: { playerId: number }) => row.playerId === ownerPlayer.id)
        .totalPoints,
    ).toBe(ownerRating);

    const managersBoard = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set(auth(owner.token));
    expect(managersBoard.body).toHaveLength(14);
  });
});
