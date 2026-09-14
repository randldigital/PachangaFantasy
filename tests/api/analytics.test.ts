import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../server/app";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createLeagueWithMembers } from "../helpers/fixtures";
import { installTestMailer } from "../helpers/mailer";

const app = createApp();

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}

function withPasscode(passcode = "2026") {
  return request(app).get("/api/analytics/overview").set("X-Analytics-Passcode", passcode);
}

describe("analytics overview", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
    installTestMailer();
    delete process.env.ANALYTICS_PASSCODE;
  });

  afterEach(() => {
    delete process.env.ANALYTICS_PASSCODE;
  });

  it("locks without a passcode and with the wrong one", async () => {
    const missing = await request(app).get("/api/analytics/overview");
    expect(missing.status).toBe(403);
    expect(missing.body.code).toBe("ANALYTICS_LOCKED");

    const wrong = await withPasscode("nope");
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe("ANALYTICS_LOCKED");
  });

  it("returns traction KPIs without identity fields", async () => {
    const empty = await withPasscode();
    expect(empty.status).toBe(200);
    expect(empty.body.hero.accounts.total).toBe(0);
    expect(empty.body.hero.competitions.total).toBe(0);
    expect(empty.body.pulse).toEqual([]);

    await createLeagueWithMembers(app, 2);

    const loaded = await withPasscode();
    expect(loaded.status).toBe(200);
    expect(loaded.body.hero.accounts.total).toBe(2);
    expect(loaded.body.hero.competitions.total).toBe(1);
    expect(loaded.body.mix.competitions.fantasy).toBe(1);
    expect(loaded.body.engagement.accounts.last30Days).toBe(2);
    expect(Array.isArray(loaded.body.pulse)).toBe(true);

    const keys = collectKeys(loaded.body);
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("username");
    expect(keys).not.toContain("inviteCode");
    expect(JSON.stringify(loaded.body)).not.toMatch(/@/);
  });
});
