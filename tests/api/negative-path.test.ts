import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
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

describe("negative paths", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("rejects over-budget, missing captain, and non-participant lineups", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const ids = (await listPlayers(app, owner.token, league.id)).map((player) => player.id);

    await request(app).post(`/api/tierlist/${league.id}/open`).set(auth(owner.token));
    await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set(auth(owner.token))
      .send({ playerTiers: ids.map((playerId) => ({ playerId, tier: "S" })), submitted: true });
    await request(app).post(`/api/tierlist/${league.id}/close`).set(auth(owner.token));

    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await request(app).post(`/api/matches/${match.id}/join`).set(auth(owner.token));

    const missingCaptain = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: ids });
    expect(missingCaptain.status).toBe(400);

    const notInMatch = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: ids, captainId: ids[0] });
    expect(notInMatch.status).toBe(400);
    expect(notInMatch.body.code).toBe("LINEUP_NOT_PARTICIPANT");

    await joinAllMatches(app, match.id, users.slice(1));
    const overBudget = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: ids, captainId: ids[0] });
    expect(overBudget.status).toBe(400);
    expect(overBudget.body.code).toBe("LINEUP_OVER_BUDGET");
  });

  it("blocks duplicate stats, inconsistent totals, and leaves a second score unchanged", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const ids = (await listPlayers(app, owner.token, league.id)).map((player) => player.id);

    await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: ids, captainId: ids[0] });

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ finalScore: 3 });

    const first = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 0 });
    expect(first.status).toBe(200);

    const duplicate = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 9, assists: 0 });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.goals).toBe(9);

    for (const user of users.slice(1)) {
      await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(user.token))
        .send({ goals: 0, assists: 0 });
    }

    const blocked = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("STATS_INCONSISTENT");

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 3, assists: 0 });

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    const firstPoints = scored.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === ids[0],
    ).points;

    const again = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(again.status).toBe(200);
    expect(
      again.body.playerPoints.find((row: { playerId: number }) => row.playerId === ids[0]).points,
    ).toBe(firstPoints);

    const locked = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 0, assists: 0 });
    expect(locked.status).toBe(400);
    expect(locked.body.code).toBe("STATS_LOCKED");
  });
});
