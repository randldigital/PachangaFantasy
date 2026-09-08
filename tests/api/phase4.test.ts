import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  createLeagueWithMembers,
  createOpenMatch,
  startMatch,
} from "../helpers/fixtures";

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

async function playerIds(app: ReturnType<typeof createApp>, token: string, leagueId: number) {
  const players = await request(app)
    .get(`/api/players/${leagueId}`)
    .set("Authorization", `Bearer ${token}`);
  return players.body.map((player: { id: number }) => player.id) as number[];
}

describe("phase 4 lineup integrity", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("recomputes cost, rejects invalid lineups, and locks after start", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;
    await joinAll(app, match.id, users);

    const ids = await playerIds(app, owner.token, league.id);
    const selected = ids.slice(0, 5);

    const tooFew = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: selected.slice(0, 4), captainId: selected[0], totalCost: 0 });
    expect(tooFew.status).toBe(400);
    expect(tooFew.body.code).toBe("LINEUP_SIZE");

    const saved = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: selected, captainId: selected[0], totalCost: 999 });
    expect(saved.status).toBe(200);
    expect(saved.body.totalCost).toBe(0);
    expect(saved.body.userId).toBe(owner.user.id);

    const started = await startMatch(app, owner.token, match.id);
    expect(started.status).toBe(200);
    expect(started.body.match.status).toBe("started");

    const locked = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: selected, captainId: selected[0] });
    expect(locked.status).toBe(400);
    expect(locked.body.code).toBe("LINEUP_LOCKED");

    const lateJoin = await request(app)
      .post(`/api/matches/${match.id}/join`)
      .set("Authorization", `Bearer ${users[1].token}`);
    expect(lateJoin.status).toBe(400);
    expect(lateJoin.body.code).toBe("MATCH_NOT_JOINABLE");
  });

  it("rejects a second Open match and a non-participant selection", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const first = await createOpenMatch(app, owner.token, league.id);
    expect(first.status).toBe(200);

    const second = await createOpenMatch(app, owner.token, league.id);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("MATCH_ALREADY_ACTIVE");

    await request(app)
      .post(`/api/matches/${first.body.id}/join`)
      .set("Authorization", `Bearer ${owner.token}`);

    const ids = await playerIds(app, owner.token, league.id);
    const notParticipant = await request(app)
      .post(`/api/matches/${first.body.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: ids.slice(0, 5), captainId: ids[0] });
    expect(notParticipant.status).toBe(400);
    expect(notParticipant.body.code).toBe("LINEUP_NOT_PARTICIPANT");

    const outsiderStart = await startMatch(app, users[1].token, first.body.id);
    expect(outsiderStart.status).toBe(403);
  });

  it("lets more than ten players join and requires start before end", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 11);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    await joinAll(app, matchResponse.body.id, users);

    const detail = await request(app)
      .get(`/api/matches/${matchResponse.body.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(detail.body.participants).toHaveLength(11);
    expect(detail.body.status).toBe("open");

    const tooSoon = await request(app)
      .post(`/api/matches/${matchResponse.body.id}/end`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ finalScore: 4 });
    expect(tooSoon.status).toBe(400);
    expect(tooSoon.body.code).toBe("MATCH_NOT_ENDABLE");
  });

  it("rejects an all-S lineup at budget 100 after valuation", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 5);
    const ids = await playerIds(app, owner.token, league.id);

    await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${owner.token}`);
    await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        playerTiers: ids.map((playerId) => ({ playerId, tier: "S" })),
        submitted: true,
      });
    await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);

    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    await joinAll(app, matchResponse.body.id, users);

    const overBudget = await request(app)
      .post(`/api/matches/${matchResponse.body.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: ids, captainId: ids[0] });
    expect(overBudget.status).toBe(400);
    expect(overBudget.body.code).toBe("LINEUP_OVER_BUDGET");
  });
});
