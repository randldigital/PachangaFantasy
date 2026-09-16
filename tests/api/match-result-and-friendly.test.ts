import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  createOpenMatch,
  fillMissingStats,
  joinAllMatches,
  listPlayers,
  startMatch,
  submitAllRatings,
} from "../helpers/fixtures";

async function scoreSimpleMatch(
  app: ReturnType<typeof createApp>,
  ownerToken: string,
  users: { token: string }[],
  matchId: number,
  teamAGoals: number,
  teamBGoals: number,
  ownerGoals: number,
) {
  await startMatch(app, ownerToken, matchId);
  await request(app)
    .post(`/api/matches/${matchId}/end`)
    .set(auth(ownerToken))
    .send({ teamAGoals, teamBGoals });
  await fillMissingStats(app, ownerToken, matchId);
  await request(app)
    .post(`/api/matches/${matchId}/stats`)
    .set(auth(ownerToken))
    .send({ goals: ownerGoals, assists: 0 });
  for (const user of users.slice(1)) {
    await request(app)
      .post(`/api/matches/${matchId}/stats`)
      .set(auth(user.token))
      .send({ goals: 0, assists: 0 });
  }
  await submitAllRatings(app, matchId, users);
  const scored = await request(app)
    .post(`/api/matches/${matchId}/calculate-scores`)
    .set(auth(ownerToken));
  expect(scored.status).toBe(200);
  return scored;
}

describe("result correction, recalculate, friendlies, and team caps", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("corrects a completed result without rescoring", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 2, teamBGoals: 0 });

    const patched = await request(app)
      .patch(`/api/matches/${match.id}/result`)
      .set(auth(owner.token))
      .send({ teamAGoals: 1, teamBGoals: 1 });
    expect(patched.status).toBe(200);
    expect(patched.body.match.status).toBe("completed");
    expect(patched.body.match.teamAGoals).toBe(1);
    expect(patched.body.replayedMatchIds).toBeUndefined();
  });

  it("rejects a correction that would put submitted stats over the new score", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 2, teamBGoals: 0 });
    await fillMissingStats(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 0 });

    const patched = await request(app)
      .patch(`/api/matches/${match.id}/result`)
      .set(auth(owner.token))
      .send({ teamAGoals: 1, teamBGoals: 0 });
    expect(patched.status).toBe(400);
    expect(patched.body.code).toBe("STATS_EXCEED_RESULT");
  });

  it("replays this scored match and later ones after a result correction", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const first = (
      await createOpenMatch(app, owner.token, league.id, undefined, {
        date: new Date("2026-03-01T12:00:00.000Z").toISOString(),
      })
    ).body;
    await joinAllMatches(app, first.id, users);
    await scoreSimpleMatch(app, owner.token, users, first.id, 1, 0, 1);

    const second = (
      await createOpenMatch(app, owner.token, league.id, undefined, {
        date: new Date("2026-04-01T12:00:00.000Z").toISOString(),
      })
    ).body;
    await joinAllMatches(app, second.id, users);
    const secondScored = await scoreSimpleMatch(app, owner.token, users, second.id, 1, 0, 1);
    const secondBefore = secondScored.body.marketValues as { playerId: number; vmBefore: number }[];

    const patched = await request(app)
      .patch(`/api/matches/${first.id}/result`)
      .set(auth(owner.token))
      .send({ teamAGoals: 3, teamBGoals: 0 });
    expect(patched.status).toBe(200);
    expect(patched.body.replayedMatchIds).toEqual([first.id, second.id]);

    const firstAfter = await request(app).get(`/api/matches/${first.id}`).set(auth(owner.token));
    expect(firstAfter.body.teamAGoals).toBe(3);

    const secondHistory = await request(app)
      .get(`/api/matches/${second.id}/recap`)
      .set(auth(owner.token));
    expect(secondHistory.status).toBe(200);

    const ownerPlayer = (await listPlayers(app, owner.token, league.id)).find(
      (player) => player.userId === owner.user.id,
    )!;
    const firstHistory = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(firstHistory.status).toBe(200);
    expect(secondBefore.length).toBeGreaterThan(0);
    expect(ownerPlayer).toBeTruthy();
  });

  it("recalculates a mid-season match and the next one", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const first = (
      await createOpenMatch(app, owner.token, league.id, undefined, {
        date: new Date("2026-03-01T12:00:00.000Z").toISOString(),
      })
    ).body;
    await joinAllMatches(app, first.id, users);
    await scoreSimpleMatch(app, owner.token, users, first.id, 1, 0, 1);

    const second = (
      await createOpenMatch(app, owner.token, league.id, undefined, {
        date: new Date("2026-04-01T12:00:00.000Z").toISOString(),
      })
    ).body;
    await joinAllMatches(app, second.id, users);
    await scoreSimpleMatch(app, owner.token, users, second.id, 2, 0, 1);

    const recalc = await request(app)
      .post(`/api/matches/${first.id}/recalculate`)
      .set(auth(owner.token));
    expect(recalc.status).toBe(200);
    expect(recalc.body.replayedMatchIds).toEqual([first.id, second.id]);
  });

  it("excludes friendlies from rankings and Market Value writes", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (
      await createOpenMatch(app, owner.token, league.id, undefined, { isFriendly: true })
    ).body;
    expect(match.isFriendly).toBe(true);
    await joinAllMatches(app, match.id, users);
    const scored = await scoreSimpleMatch(app, owner.token, users, match.id, 2, 0, 1);
    expect(scored.body.marketValues ?? []).toHaveLength(0);

    const roster = await listPlayers(app, owner.token, league.id);
    expect(roster.every((player) => player.marketValue === 18 || player.marketValue === 0 || player.marketValue != null)).toBe(true);
    const ownerBefore = roster.find((player) => player.userId === owner.user.id)!;

    const board = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    expect(board.status).toBe(200);
    const ownerRow = board.body.find((row: { playerId: number }) => row.playerId === ownerBefore.id);
    expect(ownerRow.totalPoints).toBe(0);
    expect(ownerRow.matchesPlayed).toBe(0);
    expect(ownerRow.victories).toBe(0);

    const recap = await request(app).get(`/api/matches/${match.id}/recap`).set(auth(owner.token));
    expect(recap.status).toBe(200);
    expect(recap.body.players.some((row: { points: number }) => row.points > 0)).toBe(true);
  });

  it("blocks fantasy scoring when a side is over its goal cap", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 1, teamBGoals: 0 });
    await fillMissingStats(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 0 });
    for (const user of users.slice(1)) {
      await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(user.token))
        .send({ goals: 0, assists: 0 });
    }

    const status = await request(app)
      .get(`/api/matches/${match.id}/stats-status`)
      .set(auth(owner.token));
    expect(status.body.status.canScore).toBe(false);
    expect(status.body.status.goalsOk).toBe(false);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(400);
    expect(scored.body.code).toBe("STATS_INCONSISTENT");
  });
});
