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

describe("teams, admin stats, and assist validation", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("refuses to start until every participant is on one of two teams", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const ids = (await listPlayers(app, owner.token, league.id)).map((player) => player.id);

    const withoutTeams = await request(app)
      .post(`/api/matches/${match.id}/start`)
      .set(auth(owner.token));
    expect(withoutTeams.status).toBe(400);
    expect(withoutTeams.body.code).toBe("TEAMS_REQUIRED");

    const saved = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: [ids[0]], teamB: [ids[1]] });
    expect(saved.status).toBe(200);
    expect(saved.body.match.matchTeams).toEqual({ teamA: [ids[0]], teamB: [ids[1]] });

    const started = await request(app)
      .post(`/api/matches/${match.id}/start`)
      .set(auth(owner.token));
    expect(started.status).toBe(200);
    expect(started.body.match.status).toBe("started");

    const locked = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: [ids[1]], teamB: [ids[0]] });
    expect(locked.status).toBe(400);
    expect(locked.body.code).toBe("TEAMS_LOCKED");
  });

  it("lets the admin submit statistics for another registered participant", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const roster = await listPlayers(app, owner.token, league.id);
    const memberPlayer = roster.find((player) => player.userId === users[1].user.id)!;

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 1, teamBGoals: 0 });

    const memberTryingAdmin = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(users[1].token))
      .send({ playerId: roster.find((player) => player.userId === owner.user.id)!.id, goals: 1, assists: 0 });
    expect(memberTryingAdmin.status).toBe(403);

    const forAbsent = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ playerId: memberPlayer.id, goals: 0, assists: 0 });
    expect(forAbsent.status).toBe(200);
    expect(forAbsent.body.playerId).toBe(memberPlayer.id);

    const own = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 1, assists: 0 });
    expect(own.status).toBe(200);

    const status = await request(app)
      .get(`/api/matches/${match.id}/stats-status`)
      .set(auth(owner.token));
    expect(status.body.status.state).toBe("validated");
    expect(status.body.status.canScore).toBe(true);
  });

  it("blocks scoring when assists exceed the match goal total", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 1, teamBGoals: 1 });

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 1, assists: 2 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(users[1].token))
      .send({ goals: 1, assists: 1 });

    const status = await request(app)
      .get(`/api/matches/${match.id}/stats-status`)
      .set(auth(owner.token));
    expect(status.body.status.complete).toBe(true);
    expect(status.body.status.consistent).toBe(false);
    expect(status.body.status.assistsOk).toBe(false);
    expect(status.body.status.canScore).toBe(false);

    const ack = await request(app)
      .post(`/api/matches/${match.id}/acknowledge-stats`)
      .set(auth(owner.token));
    expect(ack.status).toBe(400);
    expect(ack.body.code).toBe("STATS_ASSISTS_EXCEED");

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(400);
    expect(scored.body.code).toBe("STATS_ASSISTS_EXCEED");
  });
});
