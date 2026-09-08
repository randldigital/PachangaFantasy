import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  createLeagueWithMembers,
  createOpenMatch,
  registerUser,
  startMatch,
} from "../helpers/fixtures";

describe("phase 2 regressions", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("strips a client-supplied registration role", async () => {
    const response = await registerUser(app, 0, { role: "admin" });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("player");
  });

  it("hides match reads from non-members", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    expect(matchResponse.status).toBe(200);
    const match = matchResponse.body;

    const outsider = (await registerUser(app, 9)).body;

    const list = await request(app)
      .get(`/api/leagues/${league.id}/matches`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(list.status).toBe(404);

    const detail = await request(app)
      .get(`/api/matches/${match.id}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(detail.status).toBe(404);

    const participants = await request(app)
      .get(`/api/matches/${match.id}/participants`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(participants.status).toBe(404);

    const stats = await request(app)
      .get(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(stats.status).toBe(404);
  });

  it("does not attach admin-added players to the administrator account and persists isExternal", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);

    const created = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "El Vecino", emoji: "🧢", isExternal: true });

    expect(created.status).toBe(200);
    expect(created.body.userId).toBeNull();
    expect(created.body.isExternal).toBe(true);

    const linked = await request(app)
      .get(`/api/leagues/${league.id}/check-user-player`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(linked.body.player.name).not.toBe("El Vecino");
  });

  it("suffixes colliding league player names", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);

    const first = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Primo", isExternal: true });
    const second = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Primo", isExternal: true });

    expect(first.body.name).toBe("Primo");
    expect(second.body.name).toBe("Primo (2)");
  });

  it("rejects budgets outside 50–200 and persists the end-match goal total", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);

    const tooHigh = await request(app)
      .post("/api/matches")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        leagueId: league.id,
        date: new Date().toISOString(),
        lineupBudget: 201,
      });
    expect(tooHigh.status).toBe(400);

    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    await request(app)
      .post(`/api/matches/${matchResponse.body.id}/join`)
      .set("Authorization", `Bearer ${owner.token}`);
    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Vecino", isExternal: true });
    await request(app)
      .post(`/api/matches/${matchResponse.body.id}/add-players`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerIds: [guest.body.id] });
    await startMatch(app, owner.token, matchResponse.body.id);
    const ended = await request(app)
      .post(`/api/matches/${matchResponse.body.id}/end`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ teamAGoals: 4, teamBGoals: 3 });

    expect(ended.status).toBe(200);
    expect(ended.body.match.finalScore).toBe(7);
    expect(ended.body.match.teamAGoals).toBe(4);
    expect(ended.body.match.teamBGoals).toBe(3);
    expect(ended.body.match.status).toBe("completed");
  });

  it("does not flip a match to ready at ten participants", async () => {
    const { users, owner, league } = await createLeagueWithMembers(app, 10);
    const matchResponse = await createOpenMatch(app, owner.token, league.id);
    const match = matchResponse.body;

    for (const user of users) {
      const join = await request(app)
        .post(`/api/matches/${match.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(join.status).toBe(200);
    }

    const detail = await request(app)
      .get(`/api/matches/${match.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(detail.body.status).toBe("open");
  });

  it("rejects duplicate stats, non-participants, and stats before the match is finished", async () => {
    const { users, owner, league } = await createLeagueWithMembers(app, 2);
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

    const tooSoon = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 1, assists: 0 });
    expect(tooSoon.status).toBe(400);

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ teamAGoals: 1, teamBGoals: 0 });

    const nonParticipant = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${users[1].token}`)
      .send({ goals: 1, assists: 0 });
    expect(nonParticipant.status).toBe(403);

    const first = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 1, assists: 0 });
    expect(first.status).toBe(200);

    const duplicate = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 2, assists: 0 });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.goals).toBe(2);
    expect(duplicate.body.playerId).toBeDefined();
  });

  it("restricts scoring to the admin and is idempotent without a win bonus", async () => {
    const { users, owner, league } = await createLeagueWithMembers(app, 2);
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
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ teamAGoals: 2, teamBGoals: 0 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ goals: 2, assists: 1 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerId: guest.body.id, goals: 0, assists: 0 });

    const forbidden = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${users[1].token}`);
    expect(forbidden.status).toBe(403);

    const first = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(first.status).toBe(200);
    expect(first.body.playerPoints).toHaveLength(2);
    expect(first.body.playerPoints.find((row: { points: number }) => row.points === 8).points).toBe(8);

    const second = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(second.body.playerPoints).toHaveLength(2);
    expect(second.body.playerPoints.find((row: { points: number }) => row.points === 8).points).toBe(8);

    const rankings = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(rankings.status).toBe(200);
    expect(rankings.body.length).toBeGreaterThanOrEqual(2);
    const ownerRow = rankings.body.find((row: { userId: number }) => row.userId === owner.user.id);
    const memberRow = rankings.body.find((row: { userId: number }) => row.userId === users[1].user.id);
    expect(ownerRow.totalPoints).toBe(8);
    expect(memberRow.totalPoints).toBe(0);
  });

  it("awaits valuation writes and keeps the submitted flag on resubmit", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const players = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const playerIds = players.body.map((player: { id: number }) => player.id);
    const playerTiers = playerIds.map((playerId: number) => ({ playerId, tier: "B" }));

    const opened = await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(opened.status).toBe(200);

    const submitted = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerTiers, submitted: true });
    expect(submitted.body.submitted).toBe(true);

    const resubmitted = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerTiers, submitted: true });
    expect(resubmitted.body.submitted).toBe(true);

    const closed = await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(closed.status).toBe(200);

    const after = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(after.body[0].marketValue).toBe(18);

    const all = await request(app)
      .get(`/api/tierlist/${league.id}/all`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(all.body).toHaveLength(1);
  });

  it("signs and verifies JWTs with the configured secret only", async () => {
    const registered = await registerUser(app, 0);
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registered.body.token}`);
    expect(me.status).toBe(200);

    const forged = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(forged.status).toBe(403);
  });
});
