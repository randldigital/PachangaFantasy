import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  listPlayers,
  registerUser,
} from "../helpers/fixtures";
import { currentSeasonKey } from "@shared/domain/season";

describe("player profile", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("returns profile payload for a league member", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const players = await listPlayers(app, owner.token, league.id);
    const player = players[0];
    const season = currentSeasonKey();

    const profile = await request(app)
      .get(`/api/players/${player.id}/profile?season=${encodeURIComponent(season)}`)
      .set(auth(owner.token));

    expect(profile.status).toBe(200);
    expect(profile.body.player).toMatchObject({
      id: player.id,
      name: player.name,
      leagueId: league.id,
    });
    expect(typeof profile.body.player.marketValue).toBe("number");
    expect(profile.body.season).toBe(season);
    expect(profile.body.totals).toMatchObject({
      totalPoints: 0,
      goals: 0,
      assists: 0,
      matchesPlayed: 0,
      mvps: 0,
      victories: 0,
    });
    expect(profile.body.marketValueHistory).toEqual([]);
  });

  it("hides the profile from non-members", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const outsider = (await registerUser(app, 99)).body;
    const players = await listPlayers(app, owner.token, league.id);

    const denied = await request(app)
      .get(`/api/players/${players[0].id}/profile`)
      .set(auth(outsider.token));

    // Membership checks use 404 to avoid leaking league existence.
    expect(denied.status).toBe(404);
  });
});
