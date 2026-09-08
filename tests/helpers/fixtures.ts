import type { Express } from "express";
import request from "supertest";
import * as ratingRepo from "../../server/repos/ratingRepo";
import { meanPeerScore, mvpPlayerIds, playerMatchRating } from "@shared/domain/scoring";

export async function registerUser(
  app: Express,
  index: number,
  extras: Record<string, unknown> = {},
) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username: `player${index}`,
      email: `player${index}@pachanga.test`,
      password: "secret1",
      ...extras,
    });
  return response;
}

export async function createLeagueWithMembers(app: Express, memberCount = 2) {
  const users = [];
  for (let index = 0; index < memberCount; index += 1) {
    const response = await registerUser(app, index);
    users.push(response.body);
  }

  const owner = users[0];
  const leagueResponse = await request(app)
    .post("/api/leagues")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Parque", description: "Sunday" });

  const league = leagueResponse.body;

  for (const member of users.slice(1)) {
    await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set("Authorization", `Bearer ${member.token}`);
  }

  return { users, owner, league };
}

export async function createOpenMatch(app: Express, ownerToken: string, leagueId: number) {
  const matchResponse = await request(app)
    .post("/api/matches")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      leagueId,
      date: new Date(Date.now() + 86400000).toISOString(),
      lineupBudget: 100,
    });
  return matchResponse;
}

export async function startMatch(app: Express, ownerToken: string, matchId: number) {
  const participants = await request(app)
    .get(`/api/matches/${matchId}/participants`)
    .set(auth(ownerToken));
  const ids = ((participants.body as { playerId: number; status: string }[]) || [])
    .filter((participant) => participant.status === "accepted")
    .map((participant) => participant.playerId);
  if (ids.length >= 2) {
    const mid = Math.ceil(ids.length / 2);
    await request(app)
      .post(`/api/matches/${matchId}/teams`)
      .set(auth(ownerToken))
      .send({ teamA: ids.slice(0, mid), teamB: ids.slice(mid) });
  }
  return request(app)
    .post(`/api/matches/${matchId}/start`)
    .set("Authorization", `Bearer ${ownerToken}`);
}

export async function endMatch(
  app: Express,
  ownerToken: string,
  matchId: number,
  teamAGoals: number,
  teamBGoals = 0,
) {
  return request(app)
    .post(`/api/matches/${matchId}/end`)
    .set(auth(ownerToken))
    .send({ teamAGoals, teamBGoals });
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function submitAllRatings(
  app: Express,
  matchId: number,
  users: { token: string }[],
) {
  for (const user of users) {
    const payload = await request(app).get(`/api/matches/${matchId}/ratings`).set(auth(user.token));
    if (payload.status !== 200 || !payload.body.myBallot) {
      continue;
    }
    const voterId = payload.body.myBallot.voterPlayerId as number;
    const assignments = (payload.body.assignments ?? []) as { playerId: number }[];
    const participants = await request(app)
      .get(`/api/matches/${matchId}/participants`)
      .set(auth(user.token));
    const mvpPlayerId = (
      (participants.body as { playerId: number; status: string }[]) || []
    ).find((participant) => participant.status === "accepted" && participant.playerId !== voterId)
      ?.playerId;
    if (mvpPlayerId == null) {
      throw new Error(`no MVP candidate for voter ${voterId}`);
    }
    const submitted = await request(app)
      .post(`/api/matches/${matchId}/ratings`)
      .set(auth(user.token))
      .send({
        mvpPlayerId,
        ratings: assignments.map((row) => ({ playerId: row.playerId, score: 5 })),
      });
    if (submitted.status !== 200) {
      throw new Error(`ratings failed: ${submitted.status} ${JSON.stringify(submitted.body)}`);
    }
  }
}

export async function joinAllMatches(
  app: Express,
  matchId: number,
  users: { token: string }[],
) {
  for (const user of users) {
    const joined = await request(app)
      .post(`/api/matches/${matchId}/join`)
      .set(auth(user.token));
    if (joined.status !== 200) {
      throw new Error(`join match failed: ${joined.status} ${JSON.stringify(joined.body)}`);
    }
  }
}

export async function listPlayers(app: Express, token: string, leagueId: number) {
  const response = await request(app)
    .get(`/api/players/${leagueId}`)
    .set(auth(token));
  return response.body as { id: number; userId: number | null; name: string; marketValue?: number | null }[];
}

export async function expectedPlayerMatchRating(
  matchId: number,
  playerId: number,
  stats: { goals?: number | null; assists?: number | null },
): Promise<number> {
  const [votes, peerRatings] = await Promise.all([
    ratingRepo.getMvpVotes(matchId),
    ratingRepo.getPeerRatings(matchId),
  ]);
  return playerMatchRating({
    peerAverage: meanPeerScore(
      peerRatings.filter((row) => row.rateePlayerId === playerId).map((row) => row.score),
    ),
    goals: stats.goals,
    assists: stats.assists,
    isMvp: mvpPlayerIds(votes).has(playerId),
  });
}
