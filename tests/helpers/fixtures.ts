import type { Express } from "express";
import request from "supertest";
import * as ratingRepo from "../../server/repos/ratingRepo";
import { meanPeerScore, mvpPlayerIds, playerMatchRating } from "@shared/domain/scoring";
import { testMailer } from "./mailer";

export async function registerUser(
  app: Express,
  index: number,
  extras: Record<string, unknown> = {},
) {
  const email =
    typeof extras.email === "string" ? extras.email : `player${index}@pachanga.test`;
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username: `player${index}`,
      email,
      password: "secret1",
      ...extras,
    });
  if (response.status !== 201) {
    return response;
  }
  const token = testMailer.lastTokenFor(email);
  if (!token) {
    return response;
  }
  return request(app).get("/api/auth/verify").query({ token });
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
    .send({ name: "Parque", description: "Sunday", alias: owner.user.username });

  const league = leagueResponse.body;

  for (const member of users.slice(1)) {
    await request(app)
      .post(`/api/leagues/${league.inviteCode}/join`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ alias: member.user.username });
  }

  return { users, owner, league };
}

export async function createOpenMatch(
  app: Express,
  ownerToken: string,
  leagueId: number,
  sideSize?: 5 | 7 | 11,
) {
  const matchResponse = await request(app)
    .post("/api/matches")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      leagueId,
      date: new Date(Date.now() + 86400000).toISOString(),
      lineupBudget: 100,
      ...(sideSize ? { sideSize } : {}),
    });
  return matchResponse;
}

async function acceptedPlayerIds(app: Express, token: string, matchId: number) {
  const participants = await request(app)
    .get(`/api/matches/${matchId}/participants`)
    .set(auth(token));
  return ((participants.body as { playerId: number; status: string }[]) || [])
    .filter((participant) => participant.status === "accepted")
    .map((participant) => participant.playerId);
}

/**
 * A Fantasy Match only starts with exactly `sideSize` players per side, so tests that
 * care about something else top the squad up with external players.
 */
const paddingPlayersByMatch = new Map<number, number[]>();

export async function padMatchToCapacity(app: Express, ownerToken: string, matchId: number) {
  const match = (await request(app).get(`/api/matches/${matchId}`).set(auth(ownerToken))).body as {
    leagueId: number;
    sideSize: number;
  };
  const capacity = (match.sideSize ?? 5) * 2;
  let ids = await acceptedPlayerIds(app, ownerToken, matchId);

  const padding: number[] = [];
  let index = 0;
  while (ids.length < capacity) {
    const created = await request(app)
      .post(`/api/players/${match.leagueId}`)
      .set(auth(ownerToken))
      .send({ name: `Relleno ${Date.now()}-${index}`, isExternal: true });
    index += 1;
    padding.push(created.body.id as number);
    const added = await request(app)
      .post(`/api/matches/${matchId}/add-players`)
      .set(auth(ownerToken))
      .send({ playerIds: [created.body.id] });
    if (added.status !== 200) {
      throw new Error(`pad match failed: ${added.status} ${JSON.stringify(added.body)}`);
    }
    ids = await acceptedPlayerIds(app, ownerToken, matchId);
  }
  paddingPlayersByMatch.set(matchId, [...(paddingPlayersByMatch.get(matchId) ?? []), ...padding]);
  return ids;
}

/**
 * Zero-fills objective stats for the filler players added by `padMatchToCapacity`, so that a
 * test's assertions about the real squad's statistics still hold.
 */
export async function fillMissingStats(app: Express, ownerToken: string, matchId: number) {
  const status = await request(app)
    .get(`/api/matches/${matchId}/stats-status`)
    .set(auth(ownerToken));
  const padding = new Set(paddingPlayersByMatch.get(matchId) ?? []);
  const pending = ((status.body?.status?.pendingPlayerIds ?? []) as number[]).filter((id) =>
    padding.has(id),
  );
  for (const playerId of pending) {
    const submitted = await request(app)
      .post(`/api/matches/${matchId}/stats`)
      .set(auth(ownerToken))
      .send({ playerId, goals: 0, assists: 0 });
    if (submitted.status !== 200) {
      throw new Error(`fill stats failed: ${submitted.status} ${JSON.stringify(submitted.body)}`);
    }
  }
}

export async function startMatch(app: Express, ownerToken: string, matchId: number) {
  const ids = await padMatchToCapacity(app, ownerToken, matchId);
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
