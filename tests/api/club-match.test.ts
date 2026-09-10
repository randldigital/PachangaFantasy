import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import { auth, registerUser } from "../helpers/fixtures";
import { CLUB_TARGET_INCOMING } from "@shared/domain/clubRatingAssignments";
import { PEER_RATING_FORCE_DEFAULT } from "@shared/domain/scoring";
import { clubPlayerPoints } from "@shared/domain/clubScoring";
import { currentSeasonKey } from "@shared/domain/season";

const app = createApp();

type Registered = { token: string; user: { id: number; username: string } };

async function createClub(memberCount: number) {
  const users: Registered[] = [];
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

async function addExternals(ownerToken: string, clubId: number, count: number) {
  const created: { id: number; name: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const response = await request(app)
      .post(`/api/clubs/${clubId}/players`)
      .set(auth(ownerToken))
      .send({ name: `Externo ${index}`, isExternal: true });
    created.push(response.body);
  }
  return created;
}

async function createClubMatch(ownerToken: string, clubId: number) {
  return request(app)
    .post("/api/matches")
    .set(auth(ownerToken))
    .send({ clubId, date: new Date(Date.now() + 86400000).toISOString() });
}

/** Registers everyone, adds the externals, starts and records a 3–1 win. */
async function playClubMatch(memberCount: number, externalCount: number) {
  const { users, owner, club } = await createClub(memberCount);
  const externals = await addExternals(owner.token, club.id, externalCount);
  const match = (await createClubMatch(owner.token, club.id)).body;

  for (const user of users) {
    const joined = await request(app).post(`/api/matches/${match.id}/join`).set(auth(user.token));
    expect(joined.status).toBe(200);
  }
  if (externals.length > 0) {
    await request(app)
      .post(`/api/matches/${match.id}/add-players`)
      .set(auth(owner.token))
      .send({ playerIds: externals.map((player) => player.id) });
  }

  const started = await request(app).post(`/api/matches/${match.id}/start`).set(auth(owner.token));
  expect(started.status).toBe(200);

  const result = await request(app)
    .post(`/api/matches/${match.id}/club-result`)
    .set(auth(owner.token))
    .send({ opponentName: "Los Rivales", ourGoals: 3, opponentGoals: 1 });
  expect(result.status).toBe(200);

  return { users, owner, club, match, externals };
}

async function roster(ownerToken: string, clubId: number) {
  const response = await request(app).get(`/api/clubs/${clubId}/players`).set(auth(ownerToken));
  return response.body as { id: number; name: string; userId: number | null }[];
}

async function submitBallots(matchId: number, users: Registered[]) {
  for (const user of users) {
    const payload = await request(app).get(`/api/matches/${matchId}/ratings`).set(auth(user.token));
    if (!payload.body?.myBallot) continue;
    const voterId = payload.body.myBallot.voterPlayerId as number;
    const assignments = (payload.body.assignments ?? []) as { playerId: number }[];
    const mvpPlayerId = assignments.find((row) => row.playerId !== voterId)?.playerId;
    const submitted = await request(app)
      .post(`/api/matches/${matchId}/ratings`)
      .set(auth(user.token))
      .send({
        mvpPlayerId,
        ratings: assignments.map((row) => ({ playerId: row.playerId, score: 7 })),
      });
    expect(submitted.status).toBe(200);
  }
}

async function submitStats(
  matchId: number,
  ownerToken: string,
  entries: { playerId: number; goals: number; assists: number; minutes: number }[],
) {
  for (const entry of entries) {
    const submitted = await request(app)
      .post(`/api/matches/${matchId}/stats`)
      .set(auth(ownerToken))
      .send(entry);
    expect(submitted.status).toBe(200);
  }
}

describe("club match", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("rejects fantasy fields on a club match and a match with both contexts", async () => {
    const { owner, club } = await createClub(1);

    const withSideSize = await request(app)
      .post("/api/matches")
      .set(auth(owner.token))
      .send({ clubId: club.id, date: new Date().toISOString(), sideSize: 7 });
    expect(withSideSize.status).toBe(400);

    const withBudget = await request(app)
      .post("/api/matches")
      .set(auth(owner.token))
      .send({ clubId: club.id, date: new Date().toISOString(), lineupBudget: 100 });
    expect(withBudget.status).toBe(400);

    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: owner.user.username })
    ).body;
    const both = await request(app)
      .post("/api/matches")
      .set(auth(owner.token))
      .send({ clubId: club.id, leagueId: league.id, date: new Date().toISOString() });
    expect(both.status).toBe(400);
  });

  it("records the opponent name and score without a roster or Team A/B", async () => {
    const { owner, match } = await playClubMatch(3, 0);

    const detail = await request(app).get(`/api/matches/${match.id}`).set(auth(owner.token));
    expect(detail.body.status).toBe("completed");
    expect(detail.body.opponentName).toBe("Los Rivales");
    expect(detail.body.ourGoals).toBe(3);
    expect(detail.body.opponentGoals).toBe(1);
    expect(detail.body.matchTeams).toBeNull();
    expect(detail.body.seasonKey).toBe(currentSeasonKey());
  });

  it("gives every participant at least three incoming assigned ratings, and keeps them stable", async () => {
    const { owner, users, club, match } = await playClubMatch(6, 3);
    const squad = await roster(owner.token, club.id);

    const incoming = new Map<number, number>(squad.map((player) => [player.id, 0]));
    for (const user of users) {
      const payload = await request(app)
        .get(`/api/matches/${match.id}/ratings`)
        .set(auth(user.token));
      expect(payload.status).toBe(200);
      for (const row of payload.body.assignments as { playerId: number }[]) {
        incoming.set(row.playerId, (incoming.get(row.playerId) ?? 0) + 1);
      }
    }

    for (const player of squad) {
      expect(incoming.get(player.id) ?? 0).toBeGreaterThanOrEqual(CLUB_TARGET_INCOMING);
    }

    const first = await request(app).get(`/api/matches/${match.id}/ratings`).set(auth(owner.token));
    const second = await request(app).get(`/api/matches/${match.id}/ratings`).set(auth(owner.token));
    expect(second.body.assignments).toEqual(first.body.assignments);
  });

  it("lets externals be rated and score, but never vote", async () => {
    const { owner, users, club, match, externals } = await playClubMatch(5, 2);
    const squad = await roster(owner.token, club.id);

    await submitStats(
      match.id,
      owner.token,
      squad.map((player) => ({
        playerId: player.id,
        goals: player.id === externals[0].id ? 1 : 0,
        assists: 0,
        minutes: 90,
      })),
    );

    await submitBallots(match.id, users);

    const voters = await request(app)
      .get(`/api/matches/${match.id}/ratings`)
      .set(auth(owner.token));
    expect(voters.body.voterCount).toBe(users.length);
    expect(voters.body.ratingsComplete).toBe(true);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);
    expect(scored.body.result).toBe("win");
    expect(scored.body.playerPoints).toHaveLength(squad.length);

    const externalRow = scored.body.breakdowns.find(
      (row: { playerId: number }) => row.playerId === externals[0].id,
    );
    expect(externalRow.minutes).toBe(90);
    expect(externalRow.points).toBe(
      clubPlayerPoints({
        peerAverage: externalRow.breakdown.peerAverage,
        goals: 1,
        assists: 0,
        minutes: 90,
        result: "win",
        isMvp: false,
      }).points,
    );
  });

  it("lets the admin correct objective stats but never rate for another user", async () => {
    const { owner, users, club, match } = await playClubMatch(4, 0);
    const squad = await roster(owner.token, club.id);
    const memberPlayer = squad.find((player) => player.userId === users[1].user.id)!;

    const adminEdit = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ playerId: memberPlayer.id, goals: 2, assists: 1, minutes: 75 });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.minutes).toBe(75);

    const memberBallot = await request(app)
      .get(`/api/matches/${match.id}/ratings`)
      .set(auth(users[1].token));
    const assignments = memberBallot.body.assignments as { playerId: number }[];

    // The administrator holds their own ballot only: they cannot post as another player.
    const asOther = await request(app)
      .post(`/api/matches/${match.id}/ratings`)
      .set(auth(owner.token))
      .send({
        mvpPlayerId: assignments[0].playerId,
        ratings: assignments.map((row) => ({ playerId: row.playerId, score: 9 })),
      });
    expect(asOther.status).toBe(400);
    expect(asOther.body.code).toBe("RATINGS_INVALID");
  });

  it("rejects minutes on a fantasy match", async () => {
    const { owner } = await createClub(1);
    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: owner.user.username })
    ).body;
    const match = (
      await request(app)
        .post("/api/matches")
        .set(auth(owner.token))
        .send({ leagueId: league.id, date: new Date().toISOString(), lineupBudget: 100 })
    ).body;

    const withMinutes = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ goals: 0, assists: 0, minutes: 90 });
    expect(withMinutes.body.code).toBe("MINUTES_NOT_SUPPORTED");
  });

  it("force-scores missing incoming ratings at 6.5 and then refuses late ratings", async () => {
    const { owner, users, club, match } = await playClubMatch(5, 0);
    const squad = await roster(owner.token, club.id);

    await submitStats(
      match.id,
      owner.token,
      squad.map((player) => ({ playerId: player.id, goals: 0, assists: 0, minutes: 90 })),
    );

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
    for (const row of forced.body.breakdowns) {
      expect(row.breakdown.peerAverage).toBe(PEER_RATING_FORCE_DEFAULT);
      // Club force keeps the objective statistics: only the ratings are filled in.
      expect(row.minutes).toBe(90);
    }

    const late = await submitBallotsExpectingRejection(match.id, users);
    expect(late).toBe(400);
  });

  it("closes a scored match and freezes every later write", async () => {
    const { owner, users, club, match } = await playClubMatch(5, 0);
    const squad = await roster(owner.token, club.id);

    await submitStats(
      match.id,
      owner.token,
      squad.map((player) => ({ playerId: player.id, goals: 0, assists: 0, minutes: 60 })),
    );
    await submitBallots(match.id, users);

    const tooEarly = await request(app).post(`/api/matches/${match.id}/close`).set(auth(owner.token));
    expect(tooEarly.status).toBe(400);
    expect(tooEarly.body.code).toBe("MATCH_NOT_CLOSEABLE");

    await request(app).post(`/api/matches/${match.id}/calculate-scores`).set(auth(owner.token));

    const byMember = await request(app)
      .post(`/api/matches/${match.id}/close`)
      .set(auth(users[1].token));
    expect(byMember.status).toBe(403);

    const closed = await request(app).post(`/api/matches/${match.id}/close`).set(auth(owner.token));
    expect(closed.status).toBe(200);
    expect(closed.body.match.status).toBe("closed");

    const lateStat = await request(app)
      .post(`/api/matches/${match.id}/stats`)
      .set(auth(owner.token))
      .send({ playerId: squad[0].id, goals: 5, assists: 0, minutes: 90 });
    expect(lateStat.status).toBe(400);
    expect(lateStat.body.code).toBe("STATS_LOCKED");

    const lateScore = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(lateScore.status).toBe(400);
    expect(lateScore.body.code).toBe("MATCH_CLOSED");
  });

  it("runs the full club loop and reports rankings and history by season", async () => {
    const { owner, users, club, match, externals } = await playClubMatch(5, 3);
    const squad = await roster(owner.token, club.id);
    const ownerPlayer = squad.find((player) => player.userId === owner.user.id)!;

    await submitStats(
      match.id,
      owner.token,
      squad.map((player) => ({
        playerId: player.id,
        goals: player.id === ownerPlayer.id ? 2 : player.id === externals[0].id ? 1 : 0,
        assists: player.id === ownerPlayer.id ? 1 : 0,
        minutes: player.id === externals[0].id ? 45 : 90,
      })),
    );
    await submitBallots(match.id, users);

    const scored = await request(app)
      .post(`/api/matches/${match.id}/calculate-scores`)
      .set(auth(owner.token));
    expect(scored.status).toBe(200);

    const closed = await request(app).post(`/api/matches/${match.id}/close`).set(auth(owner.token));
    expect(closed.status).toBe(200);

    const season = currentSeasonKey();
    const seasons = await request(app).get(`/api/clubs/${club.id}/seasons`).set(auth(owner.token));
    expect(seasons.body).toEqual([season]);

    const rankings = await request(app)
      .get(`/api/clubs/${club.id}/rankings?season=${encodeURIComponent(season)}`)
      .set(auth(owner.token));
    expect(rankings.status).toBe(200);
    const ownerRow = rankings.body.find(
      (row: { playerId: number }) => row.playerId === ownerPlayer.id,
    );
    expect(ownerRow.goals).toBe(2);
    expect(ownerRow.assists).toBe(1);
    expect(ownerRow.minutes).toBe(90);
    expect(ownerRow.matchesPlayed).toBe(1);
    expect(ownerRow.marketValue).toBeGreaterThan(0);
    expect(typeof ownerRow.mvps).toBe("number");
    expect(rankings.body[0].totalPoints).toBeGreaterThanOrEqual(ownerRow.totalPoints - 0.001);
    expect(scored.body.marketValues).toHaveLength(squad.length);

    const emptySeason = await request(app)
      .get(`/api/clubs/${club.id}/rankings?season=1999/00`)
      .set(auth(owner.token));
    expect(
      emptySeason.body.every((row: { totalPoints: number }) => row.totalPoints === 0),
    ).toBe(true);

    const aggregates = await request(app)
      .get(`/api/clubs/${club.id}/aggregates`)
      .set(auth(owner.token));
    expect(aggregates.body).toEqual([
      { season, played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 3, goalsAgainst: 1 },
    ]);

    const recap = await request(app).get(`/api/matches/${match.id}/recap`).set(auth(owner.token));
    expect(recap.body.context).toBe("club");
    expect(recap.body.opponentName).toBe("Los Rivales");
    expect(recap.body.players).toHaveLength(squad.length);
    expect(recap.body.players.every((row: { team: string | null }) => row.team === null)).toBe(true);
    const ownerRecap = recap.body.players.find(
      (row: { playerId: number }) => row.playerId === ownerPlayer.id,
    );
    expect(ownerRecap.minutes).toBe(90);
    expect(ownerRecap.goals).toBe(2);
    expect(ownerRecap.vmBefore).not.toBeNull();
    expect(ownerRecap.vmAfter).not.toBeNull();

    const history = await request(app).get(`/api/clubs/${club.id}/matches`).set(auth(owner.token));
    expect(history.body).toHaveLength(1);
    expect(history.body[0].seasonKey).toBe(season);
    expect(history.body[0].status).toBe("closed");
  });
});

async function submitBallotsExpectingRejection(matchId: number, users: Registered[]) {
  for (const user of users) {
    const payload = await request(app).get(`/api/matches/${matchId}/ratings`).set(auth(user.token));
    if (!payload.body?.myBallot) continue;
    const assignments = (payload.body.assignments ?? []) as { playerId: number }[];
    const response = await request(app)
      .post(`/api/matches/${matchId}/ratings`)
      .set(auth(user.token))
      .send({
        mvpPlayerId: assignments[0].playerId,
        ratings: assignments.map((row) => ({ playerId: row.playerId, score: 8 })),
      });
    return response.status;
  }
  return 0;
}
