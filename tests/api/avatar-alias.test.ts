import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import { auth, createLeagueWithMembers, registerUser } from "../helpers/fixtures";
import { AVATAR_MAX_BYTES } from "../../server/routes/avatars";

async function pngFixture(size = 600): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 12, g: 180, b: 120 },
    },
  })
    .png()
    .toBuffer();
}

describe("avatars", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("compresses an upload and serves it back as JPEG", async () => {
    const user = (await registerUser(app, 0)).body;

    const uploaded = await request(app)
      .post("/api/users/me/avatar")
      .set(auth(user.token))
      .attach("avatar", await pngFixture(), { filename: "me.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.bytes).toBeLessThanOrEqual(AVATAR_MAX_BYTES);

    const fetched = await request(app)
      .get(`/api/users/${user.user.id}/avatar`)
      .set(auth(user.token));
    expect(fetched.status).toBe(200);
    expect(fetched.headers["content-type"]).toContain("image/jpeg");

    const metadata = await sharp(fetched.body).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(256);
  });

  it("rejects a non-image upload", async () => {
    const user = (await registerUser(app, 1)).body;
    const rejected = await request(app)
      .post("/api/users/me/avatar")
      .set(auth(user.token))
      .attach("avatar", Buffer.from("this is not an image"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe("AVATAR_NOT_IMAGE");
  });

  it("rejects an image extension whose bytes are not an image", async () => {
    const user = (await registerUser(app, 2)).body;
    const rejected = await request(app)
      .post("/api/users/me/avatar")
      .set(auth(user.token))
      .attach("avatar", Buffer.from("still not an image"), {
        filename: "fake.png",
        contentType: "image/png",
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe("AVATAR_NOT_IMAGE");
  });

  it("returns 404 when a user has no avatar", async () => {
    const user = (await registerUser(app, 3)).body;
    const missing = await request(app).get("/api/users/me/avatar").set(auth(user.token));
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("NO_AVATAR");
  });
});

describe("aliases", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("stores the alias supplied at league creation as the creator's player name", async () => {
    const owner = (await registerUser(app, 0)).body;
    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: "El Mago" })
    ).body;

    const roster = await request(app).get(`/api/players/${league.id}`).set(auth(owner.token));
    expect(roster.body).toHaveLength(1);
    expect(roster.body[0].name).toBe("El Mago");
  });

  it("requires an alias to create a league", async () => {
    const owner = (await registerUser(app, 0)).body;
    const created = await request(app)
      .post("/api/leagues")
      .set(auth(owner.token))
      .send({ name: "Parque" });
    expect(created.status).toBe(400);
  });

  it("requires an alias to join", async () => {
    const { league } = await createLeagueWithMembers(app, 1);
    const joiner = (await registerUser(app, 50)).body;
    const joined = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token));
    expect(joined.status).toBe(400);
    expect(joined.body.code).toBe("ALIAS_REQUIRED");
  });

  it("rejects an alias already taken by another account in the same league", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const joiner = (await registerUser(app, 51)).body;
    const clash = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: owner.user.username });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe("ALIAS_TAKEN");
  });

  it("allows the same alias in a different league", async () => {
    const first = await createLeagueWithMembers(app, 1);
    const second = (await registerUser(app, 52)).body;
    const otherLeague = (
      await request(app)
        .post("/api/leagues")
        .set(auth(second.token))
        .send({ name: "Otra", alias: "Duplicado" })
    ).body;

    const joiner = (await registerUser(app, 53)).body;
    const joinedFirst = await request(app)
      .post(`/api/leagues/${first.league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Duplicado" });
    expect(joinedFirst.status).toBe(200);
    expect(joinedFirst.body.player.name).toBe("Duplicado");

    const roster = await request(app)
      .get(`/api/players/${otherLeague.id}`)
      .set(auth(second.token));
    expect(roster.body[0].name).toBe("Duplicado");
  });

  it("lets only the administrator rename a player", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const roster = (await request(app).get(`/api/players/${league.id}`).set(auth(owner.token))).body;
    const target = roster.find((player: { userId: number | null }) => player.userId !== owner.user.id);

    const asMember = await request(app)
      .patch(`/api/players/${target.id}/alias`)
      .set(auth(users[1].token))
      .send({ alias: "Nuevo" });
    expect(asMember.status).toBe(403);
    expect(asMember.body.code).toBe("ADMIN_ONLY");

    const asAdmin = await request(app)
      .patch(`/api/players/${target.id}/alias`)
      .set(auth(owner.token))
      .send({ alias: "Nuevo" });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.name).toBe("Nuevo");
  });

  it("refuses a rename that collides with another alias", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    const roster = (await request(app).get(`/api/players/${league.id}`).set(auth(owner.token))).body;
    const target = roster.find((player: { userId: number | null }) => player.userId !== owner.user.id);

    const clash = await request(app)
      .patch(`/api/players/${target.id}/alias`)
      .set(auth(owner.token))
      .send({ alias: owner.user.username });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe("ALIAS_TAKEN");
  });
});

describe("claim requests", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  async function leagueWithExternal() {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const external = (
      await request(app)
        .post(`/api/players/${league.id}`)
        .set(auth(owner.token))
        .send({ name: "Invitado", isExternal: true })
    ).body;
    const joiner = (await registerUser(app, 70)).body;
    return { owner, league, external, joiner };
  }

  it("blocks membership until the administrator resolves the claim", async () => {
    const { league, external, joiner } = await leagueWithExternal();

    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("CLAIM_PENDING");
    expect(blocked.body.requestId).toBeTruthy();

    const hidden = await request(app).get(`/api/leagues/${league.id}`).set(auth(joiner.token));
    expect(hidden.status).toBe(404);

    const stillUnlinked = await request(app).get(`/api/leagues`).set(auth(joiner.token));
    expect(stillUnlinked.body).toHaveLength(0);
    void external;
  });

  it("is idempotent while the claim is pending", async () => {
    const { league, joiner } = await leagueWithExternal();

    const first = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });
    const second = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("CLAIM_PENDING");
    expect(second.body.requestId).toBe(first.body.requestId);
  });

  it("blocks a different alias too while a claim is pending", async () => {
    const { league, joiner } = await leagueWithExternal();
    await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });

    const other = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Otro nombre" });
    expect(other.status).toBe(409);
    expect(other.body.code).toBe("CLAIM_PENDING");
  });

  it("completes the join when the administrator accepts", async () => {
    const { owner, league, external, joiner } = await leagueWithExternal();
    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });

    const accepted = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.player.id).toBe(external.id);
    expect(accepted.body.player.userId).toBe(joiner.user.id);

    const visible = await request(app).get(`/api/leagues/${league.id}`).set(auth(joiner.token));
    expect(visible.status).toBe(200);
  });

  it("leaves the user out when the administrator rejects, and frees a different alias", async () => {
    const { owner, league, joiner } = await leagueWithExternal();
    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });

    const rejected = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "reject" });
    expect(rejected.status).toBe(200);

    const stillOut = await request(app).get(`/api/leagues/${league.id}`).set(auth(joiner.token));
    expect(stillOut.status).toBe(404);

    const retrySameAlias = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });
    expect(retrySameAlias.status).toBe(409);
    expect(retrySameAlias.body.code).toBe("CLAIM_PENDING");
  });

  it("lets a rejected user in under an unused alias", async () => {
    const { owner, league, joiner } = await leagueWithExternal();
    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });
    await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "reject" });

    const joined = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Nombre libre" });
    expect(joined.status).toBe(200);
    expect(joined.body.player.name).toBe("Nombre libre");
  });

  it("only lets the administrator resolve a claim", async () => {
    const { league, joiner } = await leagueWithExternal();
    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Invitado" });

    const asJoiner = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(joiner.token))
      .send({ decision: "accept" });
    expect(asJoiner.status).toBe(403);
  });
});

describe("invite codes", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("issues prefixed codes for new leagues", async () => {
    const owner = (await registerUser(app, 0)).body;
    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: "Owner" })
    ).body;
    expect(league.inviteCode).toMatch(/^L-[A-Z0-9]{6}$/);
  });

  it("still joins a legacy six-character league code", async () => {
    const owner = (await registerUser(app, 0)).body;
    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: "Owner" })
    ).body;

    // Simulate a league created before the prefix existed.
    const { db } = await import("../../server/db");
    const { leagues } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(leagues).set({ inviteCode: "OLD123" }).where(eq(leagues.id, league.id));

    const joiner = (await registerUser(app, 80)).body;
    const joined = await request(app)
      .post("/api/leagues/OLD123/join")
      .set(auth(joiner.token))
      .send({ alias: "Legacy" });
    expect(joined.status).toBe(200);
    expect(joined.body.league.id).toBe(league.id);
  });

  it("never resolves a C- code to a league", async () => {
    const joiner = (await registerUser(app, 81)).body;
    const attempted = await request(app)
      .post("/api/leagues/C-ABC123/join")
      .set(auth(joiner.token))
      .send({ alias: "Nope" });
    expect(attempted.status).toBe(404);
    expect(attempted.body.code).toBe("WRONG_INVITE_CONTEXT");
  });
});
