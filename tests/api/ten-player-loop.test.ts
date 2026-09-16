import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import {
  auth,
  createLeagueWithMembers,
  createOpenMatch,
  expectedPlayerMatchRating,
  joinAllMatches,
  listPlayers,
  registerUser,
  startMatch,
  submitAllRatings,
} from "../helpers/fixtures";
import { computeMatchMarketValues, DEFAULT_SCORING_BASELINE } from "@shared/domain/marketValue";
import * as ratingRepo from "../../server/repos/ratingRepo";

const TIERS = ["S", "A", "B", "C", "D"] as const;

describe("nine registered players plus one guest", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("turns a matching alias into a claim request the administrator must confirm", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 1);
    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(owner.token))
      .send({ name: "Invitado", emoji: "🧢", isExternal: true });
    expect(guest.status).toBe(200);
    expect(guest.body.userId).toBeNull();

    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await request(app).post(`/api/matches/${match.id}/join`).set(auth(owner.token));
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [guest.body.id] });

    const claimed = await registerUser(app, 99, {
      username: "Invitado",
      email: "invitado-claim@pachanga.test",
    });
    expect(claimed.status).toBe(200);

    const blocked = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(claimed.body.token))
      .send({ alias: "Invitado" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("CLAIM_PENDING");

    // Membership is withheld until the administrator confirms.
    const beforeConfirm = await request(app)
      .get(`/api/leagues/${league.id}`)
      .set(auth(claimed.body.token));
    expect(beforeConfirm.status).toBe(404);

    const resolved = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "accept" });
    expect(resolved.status).toBe(200);
    expect(resolved.body.player.id).toBe(guest.body.id);
    expect(resolved.body.player.userId).toBe(claimed.body.user.id);
    expect(resolved.body.player.isExternal).toBe(false);

    const participants = await request(app)
      .get(`/api/matches/${match.id}/participants`)
      .set(auth(owner.token));
    const slot = participants.body.find((row: { playerId: number }) => row.playerId === guest.body.id);
    expect(slot).toBeTruthy();
  });

  it("runs valuation, stats, ratings, and Market Value with nine accounts and a guest", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 9);
    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(owner.token))
      .send({ name: "Invitado", isExternal: true });
    expect(guest.status).toBe(200);

    const roster = await listPlayers(app, owner.token, league.id);
    expect(roster).toHaveLength(10);
    const ids = roster.map((player) => player.id);

    await request(app).post(`/api/tierlist/${league.id}/open`).set(auth(owner.token));
    for (const [voterIndex, user] of users.entries()) {
      const playerTiers = ids.map((playerId, playerIndex) => ({
        playerId,
        tier: TIERS[(voterIndex + playerIndex) % TIERS.length],
      }));
      const submitted = await request(app)
        .post(`/api/tierlist/${league.id}`)
        .set(auth(user.token))
        .send({ playerTiers, submitted: true });
      expect(submitted.status).toBe(200);
    }
    const closed = await request(app).post(`/api/tierlist/${league.id}/close`).set(auth(owner.token));
    expect(closed.status).toBe(200);

    const valued = await listPlayers(app, owner.token, league.id);
    expect(
      valued.every((player) => {
        const value = player.marketValue ?? -1;
        return Number.isInteger(value) && value >= 8 && value <= 30;
      }),
    ).toBe(true);
    expect(new Set(valued.map((player) => player.marketValue)).size).toBeGreaterThan(1);

    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [guest.body.id] });

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 4, teamBGoals: 2 });

    const ownerPlayer = valued.find((player) => player.userId === owner.user.id)!;
    const teamsPayload = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    const teamA = teamsPayload.body.matchTeams.teamA as number[];
    const teamB = teamsPayload.body.matchTeams.teamB as number[];
    const goalsByPlayer = new Map<number, { goals: number; assists: number }>();
    for (const id of [...teamA, ...teamB]) {
      goalsByPlayer.set(id, { goals: 0, assists: 0 });
    }
    if (teamA[0] != null) goalsByPlayer.set(teamA[0], { goals: 2, assists: 1 });
    if (teamA[1] != null) goalsByPlayer.set(teamA[1], { goals: 1, assists: 0 });
    if (teamA[2] != null) goalsByPlayer.set(teamA[2], { goals: 1, assists: 0 });
    if (teamB[0] != null) goalsByPlayer.set(teamB[0], { goals: 1, assists: 1 });
    if (teamB[1] != null) goalsByPlayer.set(teamB[1], { goals: 1, assists: 0 });

    const userByPlayer = new Map(valued.map((player) => [player.id, users.find((user) => user.user.id === player.userId)]));
    for (const [playerId, stats] of goalsByPlayer) {
      const user = userByPlayer.get(playerId);
      if (user) {
        await request(app)
          .post(`/api/matches/${match.id}/stats`)
          .set(auth(user.token))
          .send(stats);
      } else {
        await request(app)
          .post(`/api/matches/${match.id}/stats`)
          .set(auth(owner.token))
          .send({ playerId, ...stats });
      }
    }

    const blocked = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);
    expect(["STATS_INCONSISTENT", "STATS_ASSISTS_EXCEED", "RATINGS_INCOMPLETE"]).toContain(blocked.body.code);

    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    const ownerStats = goalsByPlayer.get(ownerPlayer.id) ?? { goals: 0, assists: 0 };
    const ownerPoints = scored.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === ownerPlayer.id,
    );
    expect(ownerPoints.points).toBe(
      await expectedPlayerMatchRating(match.id, ownerPlayer.id, ownerStats),
    );
    expect(scored.body.marketValues).toHaveLength(10);
    expect(scored.body.marketValues.some((row: { delta: number }) => row.delta !== 0)).toBe(true);

    const matchDetail = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    const reports = await request(app).get(`/api/matches/${match.id}/stats`).set(auth(owner.token));
    const [vmRows, votes, peerRatings] = await Promise.all([
      ratingRepo.getMatchPlayerVm(match.id),
      ratingRepo.getMvpVotes(match.id),
      ratingRepo.getPeerRatings(match.id),
    ]);
    const computed = computeMatchMarketValues({
      participantIds: ids,
      teamA: matchDetail.body.matchTeams.teamA,
      teamB: matchDetail.body.matchTeams.teamB,
      teamAGoals: matchDetail.body.teamAGoals,
      teamBGoals: matchDetail.body.teamBGoals,
      baseline: DEFAULT_SCORING_BASELINE,
      preMatchVm: Object.fromEntries(vmRows.map((row) => [row.playerId, row.marketValue])),
      stats: reports.body.map((row: { playerId: number; goals: number; assists: number }) => ({
        playerId: row.playerId,
        goals: row.goals,
        assists: row.assists,
      })),
      mvpVotes: votes.map((vote) => ({
        voterPlayerId: vote.voterPlayerId,
        mvpPlayerId: vote.mvpPlayerId,
      })),
      peerRatings: peerRatings.map((rating) => ({
        raterPlayerId: rating.raterPlayerId,
        rateePlayerId: rating.rateePlayerId,
        score: rating.score,
      })),
    });
    for (const row of scored.body.marketValues as { playerId: number; vmAfter: number }[]) {
      expect(row.vmAfter).toBe(computed.find((item) => item.playerId === row.playerId)!.change.vmAfter);
    }
  });
});
