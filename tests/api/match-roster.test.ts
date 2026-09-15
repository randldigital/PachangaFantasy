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
  padMatchToCapacity,
  startMatch,
} from "../helpers/fixtures";

describe("match roster join lock, leave, and remove", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("creates a closed list that blocks self-join but not admin add-players", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (
      await request(app)
        .post("/api/matches")
        .set(auth(owner.token))
        .send({
          leagueId: league.id,
          date: new Date(Date.now() + 86400000).toISOString(),
          lineupBudget: 100,
          joinOpen: false,
        })
    ).body;
    expect(match.joinOpen).toBe(false);

    const blocked = await request(app).post(`/api/matches/${match.id}/join`).set(auth(users[1].token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MATCH_JOIN_CLOSED");

    const roster = await listPlayers(app, owner.token, league.id);
    const memberPlayer = roster.find((player) => player.userId === users[1].user.id)!;
    const added = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [memberPlayer.id] });
    expect(added.status).toBe(200);
    expect(added.body.addedCount).toBe(1);
  });

  it("lets the admin reopen the list", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;

    const closed = await request(app)
      .post(`/api/matches/${match.id}/join-open`)
      .set(auth(owner.token))
      .send({ joinOpen: false });
    expect(closed.status).toBe(200);
    expect(closed.body.match.joinOpen).toBe(false);

    const memberBlocked = await request(app)
      .post(`/api/matches/${match.id}/join-open`)
      .set(auth(users[1].token))
      .send({ joinOpen: true });
    expect(memberBlocked.status).toBe(403);

    const opened = await request(app)
      .post(`/api/matches/${match.id}/join-open`)
      .set(auth(owner.token))
      .send({ joinOpen: true });
    expect(opened.status).toBe(200);
    expect(opened.body.match.joinOpen).toBe(true);

    const joined = await request(app).post(`/api/matches/${match.id}/join`).set(auth(users[1].token));
    expect(joined.status).toBe(200);
  });

  it("lets a player leave and the admin remove someone else while the match is open", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const roster = await listPlayers(app, owner.token, league.id);
    const memberPlayer = roster.find((player) => player.userId === users[1].user.id)!;
    const ownerPlayer = roster.find((player) => player.userId === owner.user.id)!;

    const otherTrying = await request(app)
      .delete(`/api/matches/${match.id}/participants/${ownerPlayer.id}`)
      .set(auth(users[1].token));
    expect(otherTrying.status).toBe(403);

    const left = await request(app)
      .delete(`/api/matches/${match.id}/participants/${memberPlayer.id}`)
      .set(auth(users[1].token));
    expect(left.status).toBe(200);

    await request(app).post(`/api/matches/${match.id}/join`).set(auth(users[1].token));
    const removed = await request(app)
      .delete(`/api/matches/${match.id}/participants/${memberPlayer.id}`)
      .set(auth(owner.token));
    expect(removed.status).toBe(200);

    const remaining = await request(app)
      .get(`/api/matches/${match.id}/participants`)
      .set(auth(owner.token));
    expect(remaining.body.map((row: { playerId: number }) => row.playerId)).not.toContain(memberPlayer.id);
  });

  it("prunes teams and lineups when a participant is removed", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const ids = await padMatchToCapacity(app, owner.token, match.id);
    const teamA = ids.slice(0, 5);
    const teamB = ids.slice(5);
    const savedTeams = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA, teamB });
    expect(savedTeams.status).toBe(200);

    const lineupIds = ids.slice(0, 5);
    const savedLineup = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: lineupIds, captainId: lineupIds[0] });
    expect(savedLineup.status).toBe(200);

    const removedId = lineupIds[0];
    const removed = await request(app)
      .delete(`/api/matches/${match.id}/participants/${removedId}`)
      .set(auth(owner.token));
    expect(removed.status).toBe(200);

    const after = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    expect(after.body.matchTeams.teamA).not.toContain(removedId);
    expect(after.body.matchTeams.teamB).not.toContain(removedId);

    const lineup = await request(app).get(`/api/matches/${match.id}/lineup`).set(auth(owner.token));
    expect(lineup.body.playerIds).not.toContain(removedId);
    expect(lineup.body.captainId).not.toBe(removedId);
  });

  it("locks leave and remove after the match starts", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const roster = await listPlayers(app, owner.token, league.id);
    const memberPlayer = roster.find((player) => player.userId === users[1].user.id)!;
    await startMatch(app, owner.token, match.id);

    const leave = await request(app)
      .delete(`/api/matches/${match.id}/participants/${memberPlayer.id}`)
      .set(auth(users[1].token));
    expect(leave.status).toBe(400);
    expect(leave.body.code).toBe("MATCH_NOT_JOINABLE");

    const closed = await request(app)
      .post(`/api/matches/${match.id}/join-open`)
      .set(auth(owner.token))
      .send({ joinOpen: false });
    expect(closed.status).toBe(400);
  });
});
