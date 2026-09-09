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
  startMatch,
  submitAllRatings,
} from "../helpers/fixtures";
import * as ratingRepo from "../../server/repos/ratingRepo";
import { computeMatchMarketValues, DEFAULT_SCORING_BASELINE } from "@shared/domain/marketValue";

describe("post-match dynamic Market Value", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("refuses scoring until every registered voter has a ballot", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 2, teamBGoals: 0 });

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 0 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(users[1].token))
      .send({ goals: 0, assists: 0 });

    const blocked = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("RATINGS_INCOMPLETE");

    await submitAllRatings(app, match.id, [owner]);
    const stillBlocked = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(stillBlocked.status).toBe(400);
    expect(stillBlocked.body.code).toBe("RATINGS_INCOMPLETE");

    await submitAllRatings(app, match.id, users);
    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
  });

  it("lets the admin force scoring with 6.5 for missing votes and no extras", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const players = await listPlayers(app, owner.token, league.id);
    const ownerPlayer = players.find((player) => player.userId === owner.user.id)!;
    const otherPlayer = players.find((player) => player.userId === users[1].user.id)!;

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 2, teamBGoals: 0 });

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 1 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(users[1].token))
      .send({ goals: 0, assists: 0 });

    const blocked = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("RATINGS_INCOMPLETE");

    const forced = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token))
      .send({ force: true });
    expect(forced.status).toBe(200);

    const ownerPoints = forced.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === ownerPlayer.id,
    );
    const otherPoints = forced.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === otherPlayer.id,
    );
    expect(ownerPoints.points).toBe(6.5);
    expect(otherPoints.points).toBe(6.5);
    expect(ownerPoints.goals).toBe(2);
    expect(ownerPoints.assists).toBe(1);
  });

  it("updates Market Value independently of Player Points and stores a replayable history row", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await joinAllMatches(app, match.id, users);
    const players = await listPlayers(app, owner.token, league.id);
    const ownerPlayer = players.find((player) => player.userId === owner.user.id)!;
    const otherPlayer = players.find((player) => player.userId === users[1].user.id)!;

    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 2, teamBGoals: 0 });

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 2, assists: 1 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(users[1].token))
      .send({ goals: 0, assists: 0 });
    await submitAllRatings(app, match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);

    const ownerPoints = scored.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === ownerPlayer.id,
    );
    const otherPoints = scored.body.playerPoints.find(
      (row: { playerId: number }) => row.playerId === otherPlayer.id,
    );
    expect(ownerPoints.points).toBe(
      await expectedPlayerMatchRating(match.id, ownerPlayer.id, { goals: 2, assists: 1 }),
    );
    expect(otherPoints.points).toBe(
      await expectedPlayerMatchRating(match.id, otherPlayer.id, { goals: 0, assists: 0 }),
    );

    const history = scored.body.marketValues as {
      playerId: number;
      vmBefore: number;
      vmAfter: number;
      performanceScore: number;
    }[];
    expect(history).toHaveLength(2);
    expect(history.some((row) => row.vmAfter !== row.vmBefore)).toBe(true);

    const afterPlayers = await listPlayers(app, owner.token, league.id);
    for (const row of history) {
      expect(afterPlayers.find((player) => player.id === row.playerId)?.marketValue).toBe(row.vmAfter);
    }

    const matchDetail = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    const reports = await request(app).get(`/api/matches/${match.id}/stats`).set(auth(owner.token));
    const [vmRows, votes, peerRatings] = await Promise.all([
      ratingRepo.getMatchPlayerVm(match.id),
      ratingRepo.getMvpVotes(match.id),
      ratingRepo.getPeerRatings(match.id),
    ]);
    const computed = computeMatchMarketValues({
      participantIds: [ownerPlayer.id, otherPlayer.id],
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

    for (const row of history) {
      const expected = computed.find((item) => item.playerId === row.playerId);
      expect(expected).toBeDefined();
      expect(row.vmAfter).toBe(expected!.change.vmAfter);
      expect(row.performanceScore).toBeCloseTo(expected!.performanceScore, 10);
    }

    const recap = await request(app).get(`/api/matches/${match.id}/recap`).set(auth(owner.token));
    expect(recap.status).toBe(200);
    expect(recap.body.teamAGoals).toBe(2);
    expect(recap.body.players).toHaveLength(2);
    const ownerRecap = recap.body.players.find((row: { playerId: number }) => row.playerId === ownerPlayer.id);
    expect(ownerRecap.goals).toBe(2);
    expect(ownerRecap.assists).toBe(1);
    expect(ownerRecap.peerAverage).not.toBeNull();
    expect(ownerRecap.vmAfter).toBe(history.find((row) => row.playerId === ownerPlayer.id)?.vmAfter);

    const board = await request(app).get(`/api/leagues/${league.id}/rankings`).set(auth(owner.token));
    expect(board.status).toBe(200);
    const ownerBoard = board.body.find((row: { playerId: number }) => row.playerId === ownerPlayer.id);
    const otherBoard = board.body.find((row: { playerId: number }) => row.playerId === otherPlayer.id);
    const ownerWon =
      (matchDetail.body.matchTeams.teamA.includes(ownerPlayer.id) && matchDetail.body.teamAGoals > matchDetail.body.teamBGoals) ||
      (matchDetail.body.matchTeams.teamB.includes(ownerPlayer.id) && matchDetail.body.teamBGoals > matchDetail.body.teamAGoals);
    expect(ownerBoard.goals).toBe(2);
    expect(ownerBoard.assists).toBe(1);
    expect(ownerBoard.matchesPlayed).toBe(1);
    expect(ownerBoard.victories).toBe(ownerWon ? 1 : 0);
    expect(otherBoard.victories).toBe(ownerWon ? 0 : 1);
    expect(ownerBoard.mvps + otherBoard.mvps).toBeGreaterThanOrEqual(1);
  });

  it("lets guests be rated but not vote", async () => {
    const { owner, users, league } = await createLeagueWithMembers(app, 2);
    const match = (await createOpenMatch(app, owner.token, league.id)).body;
    await request(app).post(`/api/matches/${match.id}/join`).set(auth(owner.token));
    const guest = await request(app)
      .post(`/api/players/${league.id}`)
      .set(auth(owner.token))
      .send({ name: "Vecino", isExternal: true });
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: [guest.body.id] });
    await startMatch(app, owner.token, match.id);
    await request(app)
      .post(`/api/matches/${match.id}/end`)
      .set(auth(owner.token))
      .send({ teamAGoals: 1, teamBGoals: 0 });

    const spectator = await request(app)
      .get(`/api/matches/${match.id}/ratings`)
      .set(auth(users[1].token));
    expect(spectator.status).toBe(200);
    expect(spectator.body.myBallot).toBeNull();
    expect(spectator.body.voterCount).toBe(1);

    const asOwner = await request(app)
      .get(`/api/matches/${match.id}/ratings`)
      .set(auth(owner.token));
    expect(asOwner.body.myBallot).toBeTruthy();
    expect(asOwner.body.assignments.some((row: { playerId: number }) => row.playerId === guest.body.id)).toBe(
      true,
    );

    const guestVote = await request(app)
      .post(`/api/matches/${match.id}/ratings`)
      .set(auth(users[1].token))
      .send({ mvpPlayerId: guest.body.id, ratings: [] });
    expect(guestVote.status).toBe(403);

    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 1, assists: 0 });
    await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ playerId: guest.body.id, goals: 0, assists: 0 });
    await submitAllRatings(app, match.id, [owner]);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    expect(
      scored.body.marketValues.some((row: { playerId: number }) => row.playerId === guest.body.id),
    ).toBe(true);
  });
});
