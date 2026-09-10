import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  createOpenMatch,
  registerUser,
} from "../helpers/fixtures";

describe("authorisation and membership", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("hides league data from outsiders and refuses member admin actions", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const member = users[1];
    const outsider = (await registerUser(app, 9)).body;
    const match = (await createOpenMatch(app, owner.token, league.id)).body;

    const hidden = [
      `/api/leagues/${league.id}`,
      `/api/players/${league.id}`,
      `/api/leagues/${league.id}/rankings`,
      `/api/leagues/${league.id}/manager-rankings`,
      `/api/leagues/${league.id}/matches`,
      `/api/matches/${match.id}`,
      `/api/matches/${match.id}/participants`,
      `/api/matches/${match.id}/stats`,
      `/api/matches/${match.id}/lineup`,
      `/api/tierlist/${league.id}`,
    ];
    for (const path of hidden) {
      const response = await request(app).get(path).set(auth(outsider.token));
      expect(response.status, path).toBeGreaterThanOrEqual(400);
    }

    const forbidden = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(member.token))
      .send({ name: "Guest", isExternal: true });
    expect(forbidden.status).toBe(403);

    const deleteLeague = await request(app)
      .delete(`/api/leagues/${league.id}`)
      .set(auth(member.token));
    expect(deleteLeague.status).toBe(403);

    const visible = await request(app).get(`/api/leagues/${league.id}`).set(auth(member.token));
    expect(visible.status).toBe(200);
  });

  it("rejects a bad invite, a second join, and a missing token", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);

    const missing = await request(app).get("/api/leagues");
    expect(missing.status).toBe(401);

    const badCode = await request(app)
      .post("/api/leagues/NOPE01/join")
      .set(auth(owner.token))
      .send({ alias: "Nope" });
    expect(badCode.status).toBe(404);
    expect(badCode.body.code).toBe("INVALID_INVITE_CODE");

    const twice = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(owner.token))
      .send({ alias: "Owner again" });
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe("ALREADY_IN_LEAGUE");
    expect(twice.body.leagueId).toBe(league.id);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: owner.user.email, password: "wrong-password" });
    expect(login.status).toBe(401);
  });
});
