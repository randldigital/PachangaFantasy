import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import { createLeagueWithMembers, registerUser } from "../helpers/fixtures";

function allTiers(playerIds: number[], tier: "S" | "A" | "B" | "C" | "D") {
  return playerIds.map((playerId) => ({ playerId, tier }));
}

async function playerIds(app: ReturnType<typeof createApp>, token: string, leagueId: number) {
  const players = await request(app)
    .get(`/api/players/${leagueId}`)
    .set("Authorization", `Bearer ${token}`);
  return players.body.map((player: { id: number }) => player.id) as number[];
}

describe("phase 3 valuation", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("rejects submit and close until the administrator opens valuation", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const ids = await playerIds(app, owner.token, league.id);

    const submitted = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerTiers: allTiers(ids, "B"), submitted: true });
    expect(submitted.status).toBe(400);

    const closed = await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(closed.status).toBe(400);
  });

  it("closes with genuine tiers, unranked default, and edit-after-submit", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const ids = await playerIds(app, owner.token, league.id);
    expect(ids).toHaveLength(2);

    const opened = await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(opened.status).toBe(200);

    const incomplete = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerTiers: [{ playerId: ids[0], tier: "S" }], submitted: true });
    expect(incomplete.status).toBe(400);

    const first = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        playerTiers: [
          { playerId: ids[0], tier: "S" },
          { playerId: ids[1], tier: "D" },
        ],
        submitted: true,
      });
    expect(first.status).toBe(200);
    expect(first.body.submitted).toBe(true);

    const edited = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        playerTiers: [
          { playerId: ids[0], tier: "A" },
          { playerId: ids[1], tier: "C" },
        ],
        submitted: true,
      });
    expect(edited.body.submitted).toBe(true);
    expect(edited.body.playerTiers).toEqual([
      { playerId: ids[0], tier: "A" },
      { playerId: ids[1], tier: "C" },
    ]);

    const member = await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${users[1].token}`)
      .send({ playerTiers: allTiers(ids, "B"), submitted: true });
    expect(member.status).toBe(200);

    const all = await request(app)
      .get(`/api/tierlist/${league.id}/all`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(all.body).toHaveLength(2);

    const closed = await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(closed.status).toBe(200);

    const after = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const byId = new Map(after.body.map((player: { id: number; marketValue: number }) => [player.id, player.marketValue]));
    expect(byId.get(ids[0])).toBe(21);
    expect(byId.get(ids[1])).toBe(15);
  });

  it("assigns B (18) when closing with no votes and when adding a player after close", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);

    await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${owner.token}`);

    const closed = await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(closed.status).toBe(200);

    const afterClose = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(afterClose.body[0].marketValue).toBe(18);

    const added = await request(app)
      .post(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "El Vecino", emoji: "🧢", isExternal: true });
    expect(added.status).toBe(200);
    expect(added.body.marketValue).toBe(18);
  });

  it("recalculates values after reopen using only the latest submitted tiers", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const ids = await playerIds(app, owner.token, league.id);

    await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${owner.token}`);
    await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerTiers: allTiers(ids, "S"), submitted: true });
    await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);

    const firstClose = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(firstClose.body[0].marketValue).toBe(30);

    const reopened = await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(reopened.status).toBe(200);

    await request(app)
      .post(`/api/tierlist/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ playerTiers: allTiers(ids, "B"), submitted: true });
    await request(app)
      .post(`/api/tierlist/${league.id}/close`)
      .set("Authorization", `Bearer ${owner.token}`);

    const secondClose = await request(app)
      .get(`/api/players/${league.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(secondClose.body[0].marketValue).toBe(18);
  });

  it("forbids non-admins from opening or closing valuation", async () => {
    const { users, league } = await createLeagueWithMembers(app, 2);
    const outsider = (await registerUser(app, 9)).body;

    const memberOpen = await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${users[1].token}`);
    expect(memberOpen.status).toBe(403);

    const strangerOpen = await request(app)
      .post(`/api/tierlist/${league.id}/open`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(strangerOpen.status).toBe(404);
  });
});
