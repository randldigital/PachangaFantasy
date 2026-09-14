import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  FEATURE_CORE_LEAGUE,
  FEATURE_PLUS_PLACEHOLDER,
  hasEntitlement,
} from "@shared/domain/entitlements";
import { createApp } from "../../server/app";
import * as billingRepo from "../../server/repos/billingRepo";
import * as passwordResetRepo from "../../server/repos/passwordResetRepo";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { auth, createLeagueWithMembers, registerUser } from "../helpers/fixtures";
import { installTestMailer, testMailer, uninstallTestMailer } from "../helpers/mailer";

const app = createApp();

describe("2.1 auth, membership and billing", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
    installTestMailer();
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.ADS_ENABLED;
    delete process.env.ADS_TEST;
    delete process.env.ADSENSE_CLIENT;
    delete process.env.ADSENSE_SLOT_OVERVIEW;
    delete process.env.ADSENSE_SLOT_HUB;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.CORS_ORIGINS;
  });

  afterEach(() => {
    installTestMailer();
  });

  it("rejects new registration when mail is not configured", async () => {
    uninstallTestMailer();
    const response = await request(app).post("/api/auth/register").send({
      username: "nomaild",
      email: "nomaild@pachanga.test",
      password: "secret1",
    });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("creates an unverified user who cannot login until the token is used", async () => {
    const registered = await request(app).post("/api/auth/register").send({
      username: "pending",
      email: "pending@pachanga.test",
      password: "secret1",
    });
    expect(registered.status).toBe(201);
    expect(registered.body.code).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(registered.body.token).toBeUndefined();

    const blocked = await request(app).post("/api/auth/login").send({
      email: "pending@pachanga.test",
      password: "secret1",
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("EMAIL_NOT_VERIFIED");

    const token = testMailer.lastTokenFor("pending@pachanga.test");
    expect(token).toBeTruthy();
    const verified = await request(app).get("/api/auth/verify").query({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.token).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({
      email: "pending@pachanga.test",
      password: "secret1",
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it("accepts confirmPassword on register and ignores it on the API", async () => {
    const registered = await request(app).post("/api/auth/register").send({
      username: "confirm",
      email: "confirm@pachanga.test",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(registered.status).toBe(201);
    expect(registered.body.code).toBe("EMAIL_VERIFICATION_REQUIRED");
  });

  it("rejects forgot-password when mail is not configured", async () => {
    uninstallTestMailer();
    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "pending@pachanga.test",
    });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("emails a reset link that changes the password without issuing a session", async () => {
    const user = await registerUser(app, 0);
    expect(user.status).toBe(200);
    const email = "player0@pachanga.test";

    const unknown = await request(app).post("/api/auth/forgot-password").send({
      email: "nobody@pachanga.test",
    });
    expect(unknown.status).toBe(200);
    expect(testMailer.sent.some((message) => message.to === "nobody@pachanga.test")).toBe(false);

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(forgot.status).toBe(200);
    const token = testMailer.lastTokenFor(email);
    expect(token).toBeTruthy();

    const reset = await request(app).post("/api/auth/reset-password").send({
      token,
      password: "secret2",
      confirmPassword: "secret2",
    });
    expect(reset.status).toBe(200);
    expect(reset.body.token).toBeUndefined();

    const oldLogin = await request(app).post("/api/auth/login").send({
      email,
      password: "secret1",
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({
      email,
      password: "secret2",
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.token).toBeTruthy();
  });

  it("rejects invalid and expired reset tokens", async () => {
    const invalid = await request(app).post("/api/auth/reset-password").send({
      token: "deadbeef",
      password: "secret2",
      confirmPassword: "secret2",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("INVALID_RESET_TOKEN");

    const user = await registerUser(app, 0);
    const expiredToken = await passwordResetRepo.issueResetToken(user.body.user.id, -1000);
    const expired = await request(app).post("/api/auth/reset-password").send({
      token: expiredToken,
      password: "secret2",
      confirmPassword: "secret2",
    });
    expect(expired.status).toBe(400);
    expect(expired.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("lets a backfilled verified user log in", async () => {
    const user = await registerUser(app, 0);
    expect(user.status).toBe(200);
    const login = await request(app).post("/api/auth/login").send({
      email: "player0@pachanga.test",
      password: "secret1",
    });
    expect(login.status).toBe(200);
  });

  it("returns 501 for Google when it is not configured", async () => {
    const start = await request(app).get("/api/auth/google");
    expect(start.status).toBe(501);
    expect(start.body.code).toBe("GOOGLE_NOT_CONFIGURED");
    const callback = await request(app).get("/api/auth/google/callback");
    expect(callback.status).toBe(501);
  });

  it("reports ads false and has no ads endpoint", async () => {
    const features = await request(app).get("/api/auth/features");
    expect(features.status).toBe(200);
    expect(features.body.ads).toBe(false);
    expect(features.body.adsClient).toBe("");
    expect(features.body.adsTest).toBe(false);
    expect(features.body.google).toBe(false);
    expect(features.body.payments).toBe(false);
    const ads = await request(app).get("/api/ads");
    expect(ads.status).toBe(404);
  });

  it("reports the AdSense client when ads are enabled", async () => {
    process.env.ADS_ENABLED = "true";
    process.env.ADSENSE_CLIENT = "pub-1018924272217472";
    process.env.ADS_TEST = "true";
    process.env.ADSENSE_SLOT_OVERVIEW = "111";
    process.env.ADSENSE_SLOT_HUB = "222";
    const features = await request(app).get("/api/auth/features");
    expect(features.status).toBe(200);
    expect(features.body.ads).toBe(true);
    expect(features.body.adsClient).toBe("ca-pub-1018924272217472");
    expect(features.body.adsTest).toBe(true);
    expect(features.body.adsSlots).toEqual({
      "overview.banner": "111",
      "hub.sidebar": "222",
    });
    const ads = await request(app).get("/api/ads");
    expect(ads.status).toBe(404);
  });

  it("closes and reopens league membership without breaking invite lookup", async () => {
    const { owner, league, users } = await createLeagueWithMembers(app, 1);
    const outsider = (await registerUser(app, 5)).body;

    const closed = await request(app)
      .post(`/api/leagues/${league.id}/membership`)
      .set(auth(owner.token))
      .send({ joinOpen: false });
    expect(closed.status).toBe(200);
    expect(closed.body.league.joinOpen).toBe(false);

    const unlinked = await request(app)
      .get(`/api/leagues/${league.inviteCode}/unlinked-players`)
      .set(auth(outsider.token));
    expect(unlinked.status).toBe(200);

    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(outsider.token))
      .send({ alias: "Newcomer" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MEMBERSHIP_CLOSED");

    await request(app)
      .post(`/api/leagues/${league.id}/membership`)
      .set(auth(owner.token))
      .send({ joinOpen: true });

    const joined = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(outsider.token))
      .send({ alias: "Newcomer" });
    expect(joined.status).toBe(200);

    const badInvite = await request(app)
      .post("/api/leagues/L-NOPE12/join")
      .set(auth(users[0].token))
      .send({ alias: "Nope" });
    expect(badInvite.status).toBe(404);
  });

  it("closes club membership the same way", async () => {
    const owner = (await registerUser(app, 0)).body;
    const club = (
      await request(app)
        .post("/api/clubs")
        .set(auth(owner.token))
        .send({ name: "Parque Club", alias: owner.user.username })
    ).body;
    const outsider = (await registerUser(app, 1)).body;
    await request(app)
      .post(`/api/clubs/${club.id}/membership`)
      .set(auth(owner.token))
      .send({ joinOpen: false });
    const blocked = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(outsider.token))
      .send({ alias: "Visitor" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MEMBERSHIP_CLOSED");
  });

  it("keeps 2.0 league APIs working on the seeded free plan", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    const plan = await billingRepo.resolvePlan({ type: "league", id: league.id });
    expect(plan).toBe("free");
    expect(hasEntitlement(plan, FEATURE_CORE_LEAGUE)).toBe(true);

    const players = await request(app).get(`/api/players/${league.id}`).set(auth(owner.token));
    expect(players.status).toBe(200);
    const matches = await request(app).get(`/api/leagues/${league.id}/matches`).set(auth(owner.token));
    expect(matches.status).toBe(200);
  });

  it("resolves entitlements per subject", async () => {
    const { owner, league, users } = await createLeagueWithMembers(app, 2);
    const member = users[1];
    await billingRepo.setPlan({ type: "user", id: member.user.id }, "plus");
    expect(await billingRepo.resolvePlan({ type: "league", id: league.id })).toBe("free");
    expect(await billingRepo.resolvePlan({ type: "user", id: member.user.id })).toBe("plus");
    expect(hasEntitlement("free", FEATURE_PLUS_PLACEHOLDER)).toBe(false);
    expect(hasEntitlement("plus", FEATURE_PLUS_PLACEHOLDER)).toBe(true);

    const denied = await request(app)
      .get("/api/billing/plus-preview")
      .query({ type: "league", id: league.id })
      .set(auth(owner.token));
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("ENTITLEMENT_REQUIRED");

    const roster = await request(app).get(`/api/players/${league.id}`).set(auth(owner.token));
    expect(roster.status).toBe(200);

    await billingRepo.setPlan({ type: "league", id: league.id }, "plus");
    const allowed = await request(app)
      .get("/api/billing/plus-preview")
      .query({ type: "league", id: league.id })
      .set(auth(owner.token));
    expect(allowed.status).toBe(200);
  });

  it("serves billing catalog and overview while checkout stays 501", async () => {
    const { owner } = await createLeagueWithMembers(app, 1);
    const plans = await request(app).get("/api/billing/plans");
    expect(plans.status).toBe(200);
    expect(plans.body.paymentsEnabled).toBe(false);
    expect(plans.body.plans.map((plan: { code: string }) => plan.code)).toEqual(["free", "plus"]);

    const overview = await request(app).get("/api/billing/overview").set(auth(owner.token));
    expect(overview.status).toBe(200);
    expect(overview.body.subjects.length).toBeGreaterThan(0);
    expect(overview.body.subjects.some((row: { planCode: string }) => row.planCode === "free")).toBe(true);

    const checkout = await request(app)
      .post("/api/billing/checkout")
      .set(auth(owner.token))
      .send({ billingAccountId: overview.body.subjects[0].billingAccountId, planCode: "plus" });
    expect(checkout.status).toBe(501);
    expect(checkout.body.code).toBe("PAYMENTS_DISABLED");

    const webhook = await request(app).post("/api/billing/webhook").send({});
    expect(webhook.status).toBe(501);
    expect(webhook.body.code).toBe("PAYMENTS_DISABLED");
  });

  it("adds CORS headers only when CORS_ORIGINS is set", async () => {
    const none = await request(app).get("/api/auth/features").set("Origin", "https://app.example");
    expect(none.headers["access-control-allow-origin"]).toBeUndefined();

    process.env.CORS_ORIGINS = "https://app.example";
    const allowed = await request(app)
      .options("/api/auth/features")
      .set("Origin", "https://app.example")
      .set("Access-Control-Request-Method", "GET");
    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example");
  });
});
