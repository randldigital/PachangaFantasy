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

  it("lets a new account claim the guest by matching username on join", async () => {
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

    const joined = await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set(auth(claimed.body.token));
    expect(joined.status).toBe(200);
    expect(joined.body.player.id).toBe(guest.body.id);
    expect(joined.body.player.userId).toBe(claimed.body.user.id);
    expect(joined.body.player.isExternal).toBe(false);

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
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 3, assists: 1 });
    for (const user of users.slice(1, 4)) {
      await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(user.token))
        .send({ goals: 1, assists: 0 });
    }
    for (const user of users.slice(4)) {
      await request(app)
        .post(`/api/matches/${match.id}/stats`)
        .set(auth(user.token))
        .send({ goals: 0, assists: 0 });
    }
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ playerId: guest.body.id, goals: 0, assists: 1 });

    const blocked = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);
    expect(["STATS_INCONSISTENT", "STATS_ASSISTS_EXCEED", "RATINGS_INCOMPLETE"]).toContain(blocked.body.code);

    const status = await request(app)
      .get(`/api/matches/${match.id}/stats-status`)
      .set(auth(owner.token));
    if (!status.body.status.canScore) {
      if (status.body.status.assistsOk === false) {
        await request(app)
          .post(`/api/matches/${match.id}/stats`)
          .set(auth(owner.token))
          .send({ playerId: guest.body.id, goals: 0, assists: 0 });
      } else if (status.body.status.complete && !status.body.status.consistent) {
        const ack = await request(app)
          .post(`/api/matches/${match.id}/acknowledge-stats`)
          .set(auth(owner.token));
        expect(ack.status).toBe(200);
      }
    }

    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    const ownerPoints = scored.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === ownerPlayer.id,
    );
    expect(ownerPoints.points).toBe(
      await expectedPlayerMatchRating(match.id, ownerPlayer.id, { goals: 3, assists: 1 }),
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
