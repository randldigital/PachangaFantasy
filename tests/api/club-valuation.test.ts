import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import { auth, registerUser } from "../helpers/fixtures";

const app = createApp();

async function createClubWithMembers(memberCount: number) {
  const users = [];
  for (let index = 0; index < memberCount; index += 1) {
    users.push((await registerUser(app, index)).body);
  }
  const owner = users[0];
  const club = (
    await request(app)
      .post("/api/clubs")
      .set(auth(owner.token))
      .send({ name: "Atlético Parque", alias: owner.user.username })
  ).body;
  for (const member of users.slice(1)) {
    await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(member.token))
      .send({ alias: member.user.username });
  }
  return { users, owner, club };
}

async function roster(token: string, clubId: number) {
  const response = await request(app).get(`/api/clubs/${clubId}/players`).set(auth(token));
  return response.body as { id: number; userId: number | null; marketValue: number }[];
}

describe("club valuation", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("rejects submit and close until the administrator opens valuation", async () => {
    const { owner, club } = await createClubWithMembers(1);
    const players = await roster(owner.token, club.id);

    const submit = await request(app)
      .post(`/api/clubs/${club.id}/tierlist`)
      .set(auth(owner.token))
      .send({ playerTiers: [{ playerId: players[0].id, tier: "B" }], submitted: true });
    expect(submit.status).toBe(400);

    const close = await request(app)
      .post(`/api/clubs/${club.id}/tierlist/close`)
      .set(auth(owner.token));
    expect(close.status).toBe(400);
  });

  it("opens, submits, closes and writes Market Value from the tier list", async () => {
    const { owner, users, club } = await createClubWithMembers(2);
    const players = await roster(owner.token, club.id);
    expect(players.every((player) => player.marketValue === 0)).toBe(true);
    const ownerPlayer = players.find((player) => player.userId === owner.user.id)!;
    const otherPlayer = players.find((player) => player.userId !== owner.user.id)!;

    const opened = await request(app)
      .post(`/api/clubs/${club.id}/tierlist/open`)
      .set(auth(owner.token));
    expect(opened.status).toBe(200);
    expect(opened.body.status).toBe("voting");

    const submitted = await request(app)
      .post(`/api/clubs/${club.id}/tierlist`)
      .set(auth(owner.token))
      .send({
        playerTiers: [
          { playerId: ownerPlayer.id, tier: "S" },
          { playerId: otherPlayer.id, tier: "C" },
        ],
        submitted: true,
      });
    expect(submitted.status).toBe(200);

    const closed = await request(app)
      .post(`/api/clubs/${club.id}/tierlist/close`)
      .set(auth(owner.token));
    expect(closed.status).toBe(200);

    const after = await roster(owner.token, club.id);
    const byId = new Map(after.map((player) => [player.id, player.marketValue]));
    expect(byId.get(ownerPlayer.id)).toBe(30);
    expect(byId.get(otherPlayer.id)).toBe(12);

    const added = await request(app)
      .post(`/api/clubs/${club.id}/players`)
      .set(auth(owner.token))
      .send({ name: "Nuevo", isExternal: true });
    expect(added.status).toBe(200);
    expect(added.body.marketValue).toBe(18);

    const asMember = await request(app)
      .post(`/api/clubs/${club.id}/tierlist/open`)
      .set(auth(users[1].token));
    expect(asMember.status).toBe(403);
  });
});
