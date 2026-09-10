import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";

describe("core loop characterisation", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("register → create league → join → create match → join match → save lineup", async () => {
    const users = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: `player${index}`,
          email: `player${index}@pachanga.test`,
          password: "secret1",
        });
      expect(response.status).toBe(200);
      expect(response.body.token).toBeTruthy();
      users.push(response.body);
    }

    const owner = users[0];
    const leagueResponse = await request(app)
      .post("/api/leagues")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Parque", description: "Sunday", alias: owner.user.username });

    expect(leagueResponse.status).toBe(200);
    expect(leagueResponse.body.inviteCode).toMatch(/^L-[A-Z0-9]{6}$/);
    const league = leagueResponse.body;

    for (const member of users.slice(1)) {
      const join = await request(app)
        .post(`/api/leagues/${league.inviteCode}/join`)
        .set("Authorization", `Bearer ${member.token}`)
        .send({ alias: member.user.username });
      expect(join.status).toBe(200);
    }

    const matchResponse = await request(app)
      .post("/api/matches")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        leagueId: league.id,
        date: new Date(Date.now() + 86400000).toISOString(),
        lineupBudget: 100,
      });

    expect(matchResponse.status).toBe(200);
    const match = matchResponse.body;

    for (const user of users) {
      const joinMatch = await request(app)
        .post(`/api/matches/${match.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(joinMatch.status).toBe(200);
    }

    const playersResponse = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(playersResponse.status).toBe(200);
    const playerIds = playersResponse.body.map((player: { id: number }) => player.id);
    expect(playerIds.length).toBeGreaterThanOrEqual(5);

    const selected = playerIds.slice(0, 5);
    const lineupResponse = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        playerIds: selected,
        captainId: selected[0],
        totalCost: 0,
      });

    expect(lineupResponse.status).toBe(200);
    expect(lineupResponse.body.playerIds).toEqual(selected);
    expect(lineupResponse.body.captainId).toBe(selected[0]);

    const outsider = await request(app)
      .post("/api/auth/register")
      .send({
        username: "outsider",
        email: "outsider@pachanga.test",
        password: "secret1",
        role: "admin",
      });
    expect(outsider.body.user.role).toBe("player");

    const hidden = await request(app)
      .get(`/api/leagues/${league.id}/matches`)
      .set("Authorization", `Bearer ${outsider.body.token}`);
    expect(hidden.status).toBe(404);

    const overBudget = await request(app)
      .post("/api/matches")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        leagueId: league.id,
        date: new Date(Date.now() + 86400000).toISOString(),
        lineupBudget: 250,
      });
    expect(overBudget.status).toBe(400);
  });
});
