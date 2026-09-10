/**
 * Deep surface catalog — every HTTP API the app exposes against the database.
 *
 * Reuse this file to confirm the product still works internally. Each `it`
 * is named as METHOD path so a failure points at one call.
 *
 * UI mapping (button / screen → API):
 *   Register                          POST /api/auth/register
 *   Login                             POST /api/auth/login
 *   Session restore                   GET  /api/auth/me
 *   Overview Create League            POST /api/leagues
 *   Overview list                     GET  /api/leagues
 *   Overview Join League              POST /api/leagues/:inviteCode/join
 *   LeagueHub load                    GET  /api/leagues/:id
 *   DeleteLeagueButton                DELETE /api/leagues/:id
 *   Agregar jugadores                 POST /api/players/:leagueId
 *   LeagueHub roster                  GET  /api/players/:leagueId
 *   Add myself / repair banner        POST /api/leagues/:leagueId/add-me-as-player
 *   Check user player                 GET  /api/leagues/:leagueId/check-user-player
 *   Abrir valoración                  POST /api/tierlist/:leagueId/open
 *   Guardar / enviar valoración       POST /api/tierlist/:leagueId
 *   Valoración propia                 GET  /api/tierlist/:leagueId
 *   Valoración de todos               GET  /api/tierlist/:leagueId/all
 *   Cerrar valoración                 POST /api/tierlist/:leagueId/close
 *   Crear partido                     POST /api/matches
 *   LeagueHub matches                 GET  /api/leagues/:leagueId/matches
 *   Ver partido                       GET  /api/matches/:id
 *   Borrar partido                    DELETE /api/matches/:id
 *   Empezar partido                   POST /api/matches/:id/start
 *   Asignar equipos                   POST /api/matches/:id/teams
 *   Terminar partido                  POST /api/matches/:id/end
 *   Unirse al partido                 POST /api/matches/:id/join
 *   Añadir jugadores al partido       POST /api/matches/:id/add-players
 *   Participantes                     GET  /api/matches/:id/participants
 *   Guardar alineación                POST /api/matches/:matchId/lineup
 *   Alineación propia                 GET  /api/matches/:matchId/lineup
 *   Enviar estadísticas               POST /api/matches/:matchId/stats
 *   Listado de stats                  GET  /api/matches/:matchId/stats
 *   Estado de stats                   GET  /api/matches/:matchId/stats-status
 *   Validar goles                     POST /api/matches/:matchId/validate-goals
 *   Reconocer stats                   POST /api/matches/:matchId/acknowledge-stats
 *   Votar MVP y compañeros            GET  /api/matches/:matchId/ratings
 *   Enviar votos                      POST /api/matches/:matchId/ratings
 *   Calcular puntuación               POST /api/matches/:matchId/calculate-scores
 *   Recap del partido                 GET  /api/matches/:id/recap
 *   Clasificación jugadores           GET  /api/leagues/:leagueId/rankings
 *   Clasificación managers            GET  /api/leagues/:leagueId/manager-rankings
 *
 * Client-only (no API, not asserted here): language switch, logout, tab clicks.
 *
 * Removed 8 Sep 2026: POST /api/leagues/:id/join. Joining is by invite code only
 * (`POST /api/leagues/:inviteCode/join`). The numeric-id route was never used
 * by the UI and was shadowed by the invite-code path.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Response } from "supertest";
import { eq } from "drizzle-orm";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  createOpenMatch,
  joinAllMatches,
  listPlayers,
  registerUser,
  fillMissingStats,
  padMatchToCapacity,
  startMatch,
  submitAllRatings,
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { players } from "@shared/schema";

const app = createApp();

function ok(response: Response, label: string, status = 200) {
  expect(response.status, `${label} → ${response.status} ${JSON.stringify(response.body)}`).toBe(
    status,
  );
}

async function valuedLeague(memberCount = 5) {
  const world = await createLeagueWithMembers(app, memberCount);
  const roster = await listPlayers(app, world.owner.token, world.league.id);
  const ids = roster.map((player) => player.id);

  ok(
    await request(app).post(`/api/tierlist/${world.league.id}/open`).set(auth(world.owner.token)),
    "open valuation",
  );
  for (const user of world.users) {
    ok(
      await request(app)
        .post(`/api/tierlist/${world.league.id}`)
        .set(auth(user.token))
        .send({
          playerTiers: ids.map((playerId) => ({ playerId, tier: "B" })),
          submitted: true,
        }),
      `submit valuation user ${user.user.id}`,
    );
  }
  ok(
    await request(app).post(`/api/tierlist/${world.league.id}/close`).set(auth(world.owner.token)),
    "close valuation",
  );

  return { ...world, roster, ids };
}

describe("deep surface catalog", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("POST /api/auth/register  POST /api/auth/login  GET /api/auth/me", async () => {
    const registered = await registerUser(app, 0);
    ok(registered, "POST /api/auth/register");
    expect(registered.body.token).toBeTruthy();
    expect(registered.body.user.email).toBe("player0@pachanga.test");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "player0@pachanga.test", password: "secret1" });
    ok(login, "POST /api/auth/login");
    expect(login.body.token).toBeTruthy();

    const me = await request(app).get("/api/auth/me").set(auth(login.body.token));
    ok(me, "GET /api/auth/me");
    expect(me.body.user.email).toBe("player0@pachanga.test");
  });

  it("POST /api/leagues  GET /api/leagues  GET /api/leagues/:id", async () => {
    const registered = await registerUser(app, 0);
    const created = await request(app)
      .post("/api/leagues")
      .set(auth(registered.body.token))
      .send({ name: "Parque", description: "Sunday", alias: "Owner" });
    ok(created, "POST /api/leagues");
    expect(created.body.inviteCode).toMatch(/^L-[A-Z0-9]{6}$/);

    const listed = await request(app).get("/api/leagues").set(auth(registered.body.token));
    ok(listed, "GET /api/leagues");
    expect(listed.body).toHaveLength(1);

    const one = await request(app)
      .get(`/api/leagues/${created.body.id}`)
      .set(auth(registered.body.token));
    ok(one, "GET /api/leagues/:id");
    expect(one.body.id).toBe(created.body.id);
  });

  it("POST /api/leagues/:inviteCode/join", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const joiner = (await registerUser(app, 90)).body;
    const joined = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(joiner.token))
      .send({ alias: "Joiner" });
    ok(joined, "POST /api/leagues/:inviteCode/join");
    expect(joined.body.league.id).toBe(league.id);
    expect(joined.body.player.userId).toBe(joiner.user.id);
    void owner;
  });

  it("POST /api/players/:leagueId  GET /api/players/:leagueId", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(owner.token))
      .send({ name: "El Vecino", emoji: "🧢", isExternal: true });
    ok(guest, "POST /api/players/:leagueId");
    expect(guest.body.isExternal).toBe(true);

    const roster = await request(app).get(`/api/players/${league.id}`).set(auth(owner.token));
    ok(roster, "GET /api/players/:leagueId");
    expect(roster.body.some((player: { name: string }) => player.name === "El Vecino")).toBe(true);
  });

  it("GET /api/leagues/:leagueId/check-user-player", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const checked = await request(app)
      .get(`/api/leagues/${league.id}/check-user-player`)
      .set(auth(owner.token));
    ok(checked, "GET /api/leagues/:leagueId/check-user-player");
    expect(checked.body.isPlayer).toBe(true);
  });

  it("POST /api/leagues/:leagueId/add-me-as-player (already a player)", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const again = await request(app)
      .post(`/api/leagues/${league.id}/add-me-as-player`)
      .set(auth(owner.token));
    ok(again, "POST /api/leagues/:leagueId/add-me-as-player already-player", 400);
  });

  it("POST /api/leagues/:leagueId/add-me-as-player (unlinked alias raises a claim)", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const roster = await listPlayers(app, owner.token, league.id);
    const own = roster.find((player) => player.userId === owner.user.id)!;
    await db.update(players).set({ userId: null }).where(eq(players.id, own.id));

    // Since 2.0 an unlinked player is never re-linked silently, even for the administrator.
    const blocked = await request(app)
      .post(`/api/leagues/${league.id}/add-me-as-player`)
      .set(auth(owner.token))
      .send({ alias: own.name });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("CLAIM_PENDING");

    const resolved = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "accept" });
    ok(resolved, "POST /api/claim-requests/:id/resolve");
    expect(resolved.body.player.userId).toBe(owner.user.id);
  });

  it("valuation open, get, get-all, submit, close", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const ids = (await listPlayers(app, owner.token, league.id)).map((player) => player.id);

    ok(
      await request(app).post(`/api/tierlist/${league.id}/open`).set(auth(owner.token)),
      "POST /api/tierlist/:leagueId/open",
    );

    const empty = await request(app).get(`/api/tierlist/${league.id}`).set(auth(owner.token));
    ok(empty, "GET /api/tierlist/:leagueId empty");
    expect(empty.body).toBeNull();

    ok(
      await request(app)
        .post(`/api/tierlist/${league.id}`)
        .set(auth(owner.token))
        .send({
          playerTiers: ids.map((playerId) => ({ playerId, tier: "A" })),
          submitted: true,
        }),
      "POST /api/tierlist/:leagueId",
    );

    const mine = await request(app).get(`/api/tierlist/${league.id}`).set(auth(owner.token));
    ok(mine, "GET /api/tierlist/:leagueId after submit");
    expect(mine.body.submitted).toBe(true);

    const all = await request(app).get(`/api/tierlist/${league.id}/all`).set(auth(owner.token));
    ok(all, "GET /api/tierlist/:leagueId/all");
    expect(all.body).toHaveLength(1);
    void users;

    ok(
      await request(app).post(`/api/tierlist/${league.id}/close`).set(auth(owner.token)),
      "POST /api/tierlist/:leagueId/close",
    );
  });

  it("match create, list, get, join, add-players, participants", async () => {
    const { owner, users, league, ids } = await valuedLeague(5);
    const created = await createOpenMatch(app, owner.token, league.id);
    ok(created, "POST /api/matches");
    const match = created.body;

    const listed = await request(app)
      .get(`/api/leagues/${league.id}/matches`)
      .set(auth(owner.token));
    ok(listed, "GET /api/leagues/:leagueId/matches");
    expect(listed.body).toHaveLength(1);

    const detail = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    ok(detail, "GET /api/matches/:id");
    expect(detail.body.id).toBe(match.id);

    ok(
      await request(app).post(`/api/matches/${match.id}/join`).set(auth(owner.token)),
      "POST /api/matches/:id/join",
    );
    await joinAllMatches(app, match.id, users.slice(1));

    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(owner.token))
      .send({ name: "Primo", isExternal: true });
    ok(guest, "add guest before add-players");

    const added = await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [guest.body.id] });
    ok(added, "POST /api/matches/:id/add-players");
    expect(added.body.addedCount).toBe(1);

    const participants = await request(app)
      .get(`/api/matches/${match.id}/participants`)
      .set(auth(owner.token));
    ok(participants, "GET /api/matches/:id/participants");
    expect(participants.body).toHaveLength(6);
    void ids;
  });

  it("POST /api/matches/:id/teams then start", async () => {
    const { owner, users, league } = await valuedLeague(2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);

    const blocked = await request(app)
      .post(`/api/matches/${match.id}/start`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("TEAMS_REQUIRED");

    const ids = await padMatchToCapacity(app, owner.token, match.id);
    const teamA = ids.slice(0, 5);
    const teamB = ids.slice(5);
    const saved = await request(app)
      .post(`/api/matches/${match.id}/teams`)
      .set(auth(owner.token))
      .send({ teamA, teamB });
    ok(saved, "POST /api/matches/:id/teams");
    expect(saved.body.match.matchTeams.teamA).toEqual(teamA);
    expect(saved.body.match.matchTeams.teamB).toEqual(teamB);

    ok(
      await request(app).post(`/api/matches/${match.id}/start`).set(auth(owner.token)),
      "POST /api/matches/:id/start after teams",
    );
  });

  it("GET+POST /api/matches/:matchId/lineup", async () => {
    const { owner, users, league, ids } = await valuedLeague(5);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);

    const empty = await request(app)
      .get(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token));
    ok(empty, "GET /api/matches/:matchId/lineup empty");
    expect(empty.body).toBeNull();

    const saved = await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: ids, captainId: ids[0] });
    ok(saved, "POST /api/matches/:matchId/lineup");
    expect(saved.body.playerIds).toEqual(ids);
    expect(saved.body.totalCost).toBe(90);

    const loaded = await request(app)
      .get(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token));
    ok(loaded, "GET /api/matches/:matchId/lineup saved");
    expect(loaded.body.captainId).toBe(ids[0]);
  });

  it("start, end, stats, validate-goals, score, both leaderboards", async () => {
    const { owner, users, league, ids } = await valuedLeague(5);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await request(app)
      .post(`/api/matches/${match.id}/lineup`)
      .set(auth(owner.token))
      .send({ playerIds: ids, captainId: ids[0] });

    ok(
      await startMatch(app, owner.token, match.id),
      "POST /api/matches/:id/start",
    );

    const ended = await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 2, teamBGoals: 0 });
    await fillMissingStats(app, owner.token, match.id);
    ok(ended, "POST /api/matches/:id/end");
    expect(ended.body.match.finalScore).toBe(2);

    ok(
      await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(owner.token))
        .send({ goals: 2, assists: 1 }),
      "POST /api/matches/:matchId/stats owner",
    );
    for (const user of users.slice(1)) {
      ok(
        await request(app)
          .post(`/api/matches/${match.id}/stats`)
          .set(auth(user.token))
          .send({ goals: 0, assists: 0 }),
        `POST /api/matches/:matchId/stats user ${user.user.id}`,
      );
    }

    const reports = await request(app)
      .get(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token));
    ok(reports, "GET /api/matches/:matchId/stats");
    expect(reports.body).toHaveLength(10);

    const status = await request(app)
      .get(`/api/matches/${match.id}/stats-status`)
      .set(auth(owner.token));
    ok(status, "GET /api/matches/:matchId/stats-status");
    expect(status.body.status.canScore).toBe(true);

    const validated = await request(app)
      .post(`/api/matches/${match.id}/validate-goals`)
      .set(auth(owner.token));
    ok(validated, "POST /api/matches/:matchId/validate-goals");
    expect(validated.body.isValid).toBe(true);

    const ratings = await request(app)
      .get(`/api/matches/${match.id}/ratings`)
      .set(auth(owner.token));
    ok(ratings, "GET /api/matches/:matchId/ratings");
    expect(ratings.body.myBallot).toBeTruthy();

    await submitAllRatings(app, match.id, users);
    const voted = await request(app)
      .get(`/api/matches/${match.id}/ratings`)
      .set(auth(owner.token));
    ok(voted, "GET /api/matches/:matchId/ratings after ballots");
    expect(voted.body.ratingsComplete).toBe(true);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    ok(scored, "POST /api/matches/:matchId/calculate-scores");

    const recap = await request(app)
      .get(`/api/matches/${match.id}/recap`)
      .set(auth(owner.token));
    ok(recap, "GET /api/matches/:id/recap");
    expect(recap.body.players.length).toBeGreaterThanOrEqual(5);

    const playersBoard = await request(app)
      .get(`/api/leagues/${league.id}/rankings`)
      .set(auth(owner.token));
    ok(playersBoard, "GET /api/leagues/:leagueId/rankings");
    expect(playersBoard.body.length).toBeGreaterThanOrEqual(5);

    const managersBoard = await request(app)
      .get(`/api/leagues/${league.id}/manager-rankings`)
      .set(auth(owner.token));
    ok(managersBoard, "GET /api/leagues/:leagueId/manager-rankings");
    expect(managersBoard.body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/matches/:matchId/acknowledge-stats", async () => {
    const { owner, users, league } = await valuedLeague(2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 3, teamBGoals: 0 });
    await fillMissingStats(app, owner.token, match.id);

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 0 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(users[1].token))
      .send({ goals: 0, assists: 0 });

    const acknowledged = await request(app)
      .post(`/api/matches/${match.id}/acknowledge-stats`)
      .set(auth(owner.token));
    ok(acknowledged, "POST /api/matches/:matchId/acknowledge-stats");
    expect(acknowledged.body.status.canScore).toBe(true);
  });

  it("DELETE /api/matches/:id", async () => {
    const { owner, league } = await valuedLeague(1);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    const deleted = await request(app)
      .delete(`/api/matches/${match.id}`)
      .set(auth(owner.token));
    ok(deleted, "DELETE /api/matches/:id");

    const listed = await request(app)
      .get(`/api/leagues/${league.id}/matches`)
      .set(auth(owner.token));
    expect(listed.body).toHaveLength(0);
  });

  it("DELETE /api/leagues/:id", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const deleted = await request(app)
      .delete(`/api/leagues/${league.id}`)
      .set(auth(owner.token));
    ok(deleted, "DELETE /api/leagues/:id");

    const listed = await request(app).get("/api/leagues").set(auth(owner.token));
    expect(listed.body).toHaveLength(0);
  });
});
