import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  createLeagueWithMembers,
  createOpenMatch,
  fillMissingStats,
  startMatch,
  submitAllRatings,
} from "../helpers/fixtures";

async function finishMatch(
  app: ReturnType<typeof createApp>,
  token: string,
  matchId: number,
  teamAGoals: number,
  teamBGoals = 0,
) {
  await startMatch(app, token, matchId);
  const ended = await request(app)
    .post(`/api/matches/${matchId}/end`)
    .set("Authorization", `Bearer ${token}`)
    .send({ teamAGoals, teamBGoals });
  await fillMissingStats(app, token, matchId);
  return ended;
}

describe("phase 5 statistics and validation", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("keys statistics to the player and lets the admin submit for externals", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;

    const external = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "El Vecino", emoji: "🧢", isExternal: true });
    expect(external.status).toBe(200);

    await request(app)
      .post(`/api/matches/${match.id}/join`)
      .set("Authorization", `Bearer ${owner.token}`);
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: [external.body.id] });

    await finishMatch(app, owner.token, match.id, 3);

    const own = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 2, assists: 1 });
    expect(own.status).toBe(200);
    expect(own.body.playerId).toBeDefined();
    expect(own.body.userId).toBeUndefined();

    const forExternal = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerId: external.body.id, goals: 1, assists: 0 });
    expect(forExternal.status).toBe(200);
    expect(forExternal.body.playerId).toBe(external.body.id);

    const listed = await request(app)
      .get(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(listed.body).toHaveLength(10);
    expect(listed.body.every((row: { playerId: number }) => row.playerId)).toBe(true);

    const status = await request(app)
      .get(`/api/matches/${match.id}/stats-status`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(status.body.status.state).toBe("validated");
    expect(status.body.status.canScore).toBe(true);
  });

  it("allows edits until scored and then freezes statistics", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;
    await request(app)
      .post(`/api/matches/${match.id}/join`)
      .set("Authorization", `Bearer ${owner.token}`);
    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Vecino", isExternal: true });
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: [guest.body.id] });
    await finishMatch(app, owner.token, match.id, 1);

    const first = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 0, assists: 0 });
    expect(first.status).toBe(200);

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerId: guest.body.id, goals: 0, assists: 0 });

    const edited = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 1, assists: 1 });
    expect(edited.status).toBe(200);
    expect(edited.body.goals).toBe(1);
    expect(edited.body.assists).toBe(1);

    await submitAllRatings(app, match.id, [owner]);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(scored.status).toBe(200);

    const frozen = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 4, assists: 0 });
    expect(frozen.status).toBe(400);
    expect(frozen.body.code).toBe("STATS_LOCKED");
  });

  it("refuses scoring until statistics are complete and consistent, unless acknowledged", async () => {
    const { users, owner, league } = await createLeagueWithMembers(app, 2);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;

    await request(app)
      .post(`/api/matches/${match.id}/join`)
      .set("Authorization", `Bearer ${owner.token}`);
    await request(app)
      .post(`/api/matches/${match.id}/join`)
      .set("Authorization", `Bearer ${users[1].token}`);
    await finishMatch(app, owner.token, match.id, 2);

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 2, assists: 0 });

    const incomplete = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.code).toBe("STATS_INCOMPLETE");

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${users[1].token}`)
      .send({ goals: 2, assists: 0 });

    const inconsistent = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(inconsistent.status).toBe(400);
    expect(inconsistent.body.code).toBe("STATS_INCONSISTENT");
    expect(inconsistent.body.difference).toBe(2);

    const memberAck = await request(app)
      .post(`/api/matches/${match.id}/acknowledge-stats`)
      .set("Authorization", `Bearer ${users[1].token}`);
    expect(memberAck.status).toBe(403);

    const ack = await request(app)
      .post(`/api/matches/${match.id}/acknowledge-stats`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ack.status).toBe(200);
    expect(ack.body.status.canScore).toBe(true);
    expect(ack.body.status.state).toBe("inconsistent");

    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(scored.status).toBe(200);
  });
});
