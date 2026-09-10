import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import { auth, createLeagueWithMembers, listPlayers } from "../helpers/fixtures";

async function createMatch(
  app: ReturnType<typeof createApp>,
  token: string,
  leagueId: number,
  sideSize?: number,
) {
  return request(app)
    .post("/api/matches")
    .set(auth(token))
    .send({
      leagueId,
      date: new Date(Date.now() + 86400000).toISOString(),
      lineupBudget: 100,
      ...(sideSize == null ? {} : { sideSize }),
    });
}

/** Fills the roster with externals so a match can reach any capacity. */
async function padRoster(
  app: ReturnType<typeof createApp>,
  token: string,
  leagueId: number,
  total: number,
) {
  let roster = await listPlayers(app, token, leagueId);
  let index = 0;
  while (roster.length < total) {
    await request(app)
      .post(`/api/players/${leagueId}`)
      .set(auth(token))
      .send({ name: `Externo ${index}`, isExternal: true });
    index += 1;
    roster = await listPlayers(app, token, leagueId);
  }
  return roster;
}

describe("fantasy match side size", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("defaults to 5v5 and accepts 5, 7 and 11", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);

    const defaulted = await createMatch(app, owner.token, league.id);
    expect(defaulted.status).toBe(200);
    expect(defaulted.body.sideSize).toBe(5);

    await request(app).delete(`/api/matches/${defaulted.body.id}`).set(auth(owner.token));

    for (const size of [7, 11]) {
      const created = await createMatch(app, owner.token, league.id, size);
      expect(created.status).toBe(200);
      expect(created.body.sideSize).toBe(size);
      await request(app).delete(`/api/matches/${created.body.id}`).set(auth(owner.token));
    }
  });

  it("rejects a side size that is not 5, 7 or 11", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const created = await createMatch(app, owner.token, league.id, 9);
    expect(created.status).toBe(400);
  });

  it("allows seven per side but rejects the eighth in a 7v7", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const roster = await padRoster(app, owner.token, league.id, 15);
    const match = (await createMatch(app, owner.token, league.id, 7)).body;

    const ids = roster.map((player) => player.id);
    const added = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: ids.slice(0, 14) });
    expect(added.status).toBe(200);

    // Fifteenth participant overall is refused: capacity is sideSize × 2.
    const overflow = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [ids[14]] });
    expect(overflow.status).toBe(400);
    expect(overflow.body.code).toBe("MATCH_FULL");

    const sevenOnA = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: ids.slice(0, 7), teamB: ids.slice(7, 14) });
    expect(sevenOnA.status).toBe(200);
    expect(sevenOnA.body.complete).toBe(true);

    const eighthOnA = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: ids.slice(0, 8), teamB: ids.slice(8, 14) });
    expect(eighthOnA.status).toBe(400);
    expect(eighthOnA.body.code).toBe("SIDE_OVER_CAPACITY");
  });

  it("starts a 7v7 with fourteen participants but not with thirteen", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const roster = await padRoster(app, owner.token, league.id, 14);
    const ids = roster.map((player) => player.id);

    const short = (await createMatch(app, owner.token, league.id, 7)).body;
    await request(app)
      .post(`/api/matches/${short.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: ids.slice(0, 13) });
    await request(app)
      .post(`/api/matches/${short.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: ids.slice(0, 7), teamB: ids.slice(7, 13) });
    const refused = await request(app).post(`/api/matches/${short.id}/start`).set(auth(owner.token));
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe("SIDE_INCOMPLETE");

    await request(app)
      .post(`/api/matches/${short.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [ids[13]] });
    await request(app)
      .post(`/api/matches/${short.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA: ids.slice(0, 7), teamB: ids.slice(7, 14) });
    const started = await request(app).post(`/api/matches/${short.id}/start`).set(auth(owner.token));
    expect(started.status).toBe(200);
  });

  it("caps joining at sideSize × 2 for a 5v5", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const roster = await padRoster(app, owner.token, league.id, 11);
    const match = (await createMatch(app, owner.token, league.id, 5)).body;
    const ids = roster.map((player) => player.id);

    const filled = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: ids.slice(0, 10) });
    expect(filled.status).toBe(200);

    const eleventh = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [ids[10]] });
    expect(eleventh.status).toBe(400);
    expect(eleventh.body.code).toBe("MATCH_FULL");
  });

  it("keeps the lineup at five on an 11v11", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const roster = await padRoster(app, owner.token, league.id, 22);
    const match = (await createMatch(app, owner.token, league.id, 11)).body;
    const ids = roster.map((player) => player.id);

    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: ids.slice(0, 22) });

    const tooMany = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(users[1].token))
      .send({ playerIds: ids.slice(0, 6), captainId: ids[0] });
    expect(tooMany.status).toBe(400);

    const exactlyFive = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(users[1].token))
      .send({ playerIds: ids.slice(0, 5), captainId: ids[0] });
    expect(exactlyFive.status).toBe(200);
  });

  it("treats a match stored without a side size as 5v5", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const roster = await padRoster(app, owner.token, league.id, 11);
    const match = (await createMatch(app, owner.token, league.id, 5)).body;

    const { db } = await import("../../server/db");
    const { matches } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");
    await db.execute(
      sql`UPDATE ${matches} SET side_size = DEFAULT WHERE ${matches.id} = ${match.id}`,
    );
    const [reloaded] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(reloaded.sideSize).toBe(5);

    const ids = roster.map((player) => player.id);
    const overflow = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: ids.slice(0, 11) });
    expect(overflow.status).toBe(400);
    expect(overflow.body.code).toBe("MATCH_FULL");
  });
});
