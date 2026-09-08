import type { Express } from "express";
import request from "supertest";

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
  return request(app)
    .post(`/api/matches/${matchId}/start`)
    .set("Authorization", `Bearer ${ownerToken}`);
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
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
