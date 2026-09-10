import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { createApp } from "../../server/app";
import { auth, createLeagueWithMembers, registerUser } from "../helpers/fixtures";
import { CLUB_INVITE_PREFIX, LEAGUE_INVITE_PREFIX } from "@shared/domain/inviteCodes";

const app = createApp();

async function createClubWithMembers(memberCount = 2, firstIndex = 0) {
  const users = [];
  for (let index = firstIndex; index < firstIndex + memberCount; index += 1) {
    users.push((await registerUser(app, index)).body);
  }
  const owner = users[0];
  const club = (
    await request(app)
      .post("/api/clubs")
      .set(auth(owner.token))
      .send({ name: "Atlético Parque", description: "Los de siempre", alias: owner.user.username })
  ).body;

  for (const member of users.slice(1)) {
    const joined = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(member.token))
      .send({ alias: member.user.username });
    expect(joined.status).toBe(200);
  }

  return { users, owner, club };
}

describe("club entity", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("creates a club with a C- invite code and the creator as a player", async () => {
    const { owner, club } = await createClubWithMembers(1);

    expect(club.inviteCode.startsWith(CLUB_INVITE_PREFIX)).toBe(true);
    expect(club.inviteCode).toHaveLength(8);
    expect(club.participants).toEqual([owner.user.id]);

    const roster = await request(app)
      .get(`/api/clubs/${club.id}/players`)
      .set(auth(owner.token));
    expect(roster.status).toBe(200);
    expect(roster.body).toHaveLength(1);
    expect(roster.body[0].name).toBe(owner.user.username);
    expect(roster.body[0].clubId).toBe(club.id);
    expect(roster.body[0].leagueId).toBeNull();
  });

  it("keeps league and club invite codes in their own context", async () => {
    const { league } = await createLeagueWithMembers(app, 1);
    const outsider = (await registerUser(app, 90)).body;
    const { club } = await createClubWithMembers(1, 10);

    expect(league.inviteCode.startsWith(LEAGUE_INVITE_PREFIX)).toBe(true);

    const leagueCodeOnClub = await request(app)
      .post(`/api/clubs/${league.inviteCode}/join`)
      .set(auth(outsider.token))
      .send({ alias: "Intruso" });
    expect(leagueCodeOnClub.status).toBe(404);
    expect(leagueCodeOnClub.body.code).toBe("WRONG_INVITE_CONTEXT");

    const clubCodeOnLeague = await request(app)
      .post(`/api/leagues/${club.inviteCode}/join`)
      .set(auth(outsider.token))
      .send({ alias: "Intruso" });
    expect(clubCodeOnLeague.status).toBe(404);
    expect(clubCodeOnLeague.body.code).toBe("WRONG_INVITE_CONTEXT");
  });

  it("scopes aliases to one club and allows the same alias in a league", async () => {
    const { owner, users, club } = await createClubWithMembers(2);
    const outsider = (await registerUser(app, 90)).body;

    const duplicate = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(outsider.token))
      .send({ alias: users[1].user.username });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("ALIAS_TAKEN");

    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: users[1].user.username })
    ).body;
    const leagueRoster = await request(app)
      .get(`/api/players/${league.id}`)
      .set(auth(owner.token));
    expect(leagueRoster.body).toHaveLength(1);
    expect(leagueRoster.body[0].name).toBe(users[1].user.username);
  });

  it("raises a claim request for an external alias and blocks membership until accepted", async () => {
    const { owner, club } = await createClubWithMembers(1);
    const newcomer = (await registerUser(app, 90)).body;

    const external = await request(app)
      .post(`/api/clubs/${club.id}/players`)
      .set(auth(owner.token))
      .send({ name: "El Vecino", isExternal: true });
    expect(external.status).toBe(200);

    const blocked = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(newcomer.token))
      .send({ alias: "El Vecino" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("CLAIM_PENDING");

    const stillBlocked = await request(app)
      .get(`/api/clubs/${club.id}`)
      .set(auth(newcomer.token));
    expect(stillBlocked.status).toBe(404);

    const pending = await request(app)
      .get(`/api/clubs/${club.id}/claim-requests`)
      .set(auth(owner.token));
    expect(pending.status).toBe(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].playerName).toBe("El Vecino");

    const accepted = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.club.participants).toContain(newcomer.user.id);
    expect(accepted.body.player.userId).toBe(newcomer.user.id);

    const nowVisible = await request(app)
      .get(`/api/clubs/${club.id}`)
      .set(auth(newcomer.token));
    expect(nowVisible.status).toBe(200);
  });

  it("lets a newcomer claim an unlinked player by id and still waits for accept", async () => {
    const { owner, club } = await createClubWithMembers(1);
    const newcomer = (await registerUser(app, 91)).body;

    const external = await request(app)
      .post(`/api/clubs/${club.id}/players`)
      .set(auth(owner.token))
      .send({ name: "El Vecino", isExternal: true });
    expect(external.status).toBe(200);

    const listed = await request(app)
      .get(`/api/clubs/${club.inviteCode}/unlinked-players`)
      .set(auth(newcomer.token));
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ id: external.body.id, name: "El Vecino" }),
    ]);

    const clubCodeOnLeague = await request(app)
      .get(`/api/leagues/${club.inviteCode}/unlinked-players`)
      .set(auth(newcomer.token));
    expect(clubCodeOnLeague.status).toBe(404);
    expect(clubCodeOnLeague.body.code).toBe("WRONG_INVITE_CONTEXT");

    const blocked = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(newcomer.token))
      .send({ playerId: external.body.id });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("CLAIM_PENDING");

    const retry = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(newcomer.token))
      .send({ playerId: external.body.id });
    expect(retry.body.requestId).toBe(blocked.body.requestId);

    const stillOut = await request(app).get(`/api/clubs/${club.id}`).set(auth(newcomer.token));
    expect(stillOut.status).toBe(404);

    const asMember = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(owner.token))
      .send({ playerId: external.body.id });
    expect(asMember.status).toBe(409);
    expect(asMember.body.code).toBe("ALREADY_IN_CLUB");

    const accepted = await request(app)
      .post(`/api/claim-requests/${blocked.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.club.participants).toContain(newcomer.user.id);
    expect(accepted.body.player.userId).toBe(newcomer.user.id);
    expect(accepted.body.player.id).toBe(external.body.id);
  });

  it("only lets members read the club", async () => {
    const { club } = await createClubWithMembers(1);
    const outsider = (await registerUser(app, 90)).body;

    const denied = await request(app).get(`/api/clubs/${club.id}`).set(auth(outsider.token));
    expect(denied.status).toBe(404);

    const listed = await request(app).get("/api/clubs").set(auth(outsider.token));
    expect(listed.body).toEqual([]);
  });

  it("only lets the creator delete the club", async () => {
    const { owner, users, club } = await createClubWithMembers(2);

    const byMember = await request(app)
      .delete(`/api/clubs/${club.id}`)
      .set(auth(users[1].token));
    expect(byMember.status).toBe(403);

    const byOwner = await request(app).delete(`/api/clubs/${club.id}`).set(auth(owner.token));
    expect(byOwner.status).toBe(200);

    const gone = await request(app).get(`/api/clubs/${club.id}`).set(auth(owner.token));
    expect(gone.status).toBe(404);
  });

  it("keeps club rankings, seasons and history empty until matches are played", async () => {
    const { owner, club } = await createClubWithMembers(2);

    const seasons = await request(app)
      .get(`/api/clubs/${club.id}/seasons`)
      .set(auth(owner.token));
    expect(seasons.body).toEqual([]);

    const rankings = await request(app)
      .get(`/api/clubs/${club.id}/rankings`)
      .set(auth(owner.token));
    expect(rankings.status).toBe(200);
    expect(rankings.body).toHaveLength(2);
    expect(rankings.body.every((row: { totalPoints: number }) => row.totalPoints === 0)).toBe(true);

    const aggregates = await request(app)
      .get(`/api/clubs/${club.id}/aggregates`)
      .set(auth(owner.token));
    expect(aggregates.body).toEqual([]);

    const matches = await request(app)
      .get(`/api/clubs/${club.id}/matches`)
      .set(auth(owner.token));
    expect(matches.body).toEqual([]);
  });

  it("keeps a user's club player separate from their league player", async () => {
    const { owner, club } = await createClubWithMembers(1);
    const league = (
      await request(app)
        .post("/api/leagues")
        .set(auth(owner.token))
        .send({ name: "Parque", alias: owner.user.username })
    ).body;

    const clubRoster = await request(app)
      .get(`/api/clubs/${club.id}/players`)
      .set(auth(owner.token));
    const leagueRoster = await request(app)
      .get(`/api/players/${league.id}`)
      .set(auth(owner.token));

    expect(clubRoster.body[0].clubId).toBe(club.id);
    expect(clubRoster.body[0].leagueId).toBeNull();
    expect(leagueRoster.body[0].leagueId).toBe(league.id);
    expect(leagueRoster.body[0].clubId).toBeNull();
  });

  it("lets a member leave: player stays unlinked and reclaim needs accept", async () => {
    const { owner, users, club } = await createClubWithMembers(2);
    const member = users[1];
    const before = (
      await request(app).get(`/api/clubs/${club.id}/players`).set(auth(owner.token))
    ).body.find((player: { userId: number | null }) => player.userId === member.user.id);

    const asOwner = await request(app).post(`/api/clubs/${club.id}/leave`).set(auth(owner.token));
    expect(asOwner.status).toBe(409);
    expect(asOwner.body.code).toBe("ADMIN_CANNOT_LEAVE");

    const left = await request(app).post(`/api/clubs/${club.id}/leave`).set(auth(member.token));
    expect(left.status).toBe(200);
    expect(left.body.player.id).toBe(before.id);
    expect(left.body.player.userId).toBeNull();
    expect(left.body.club.participants).not.toContain(member.user.id);

    const hidden = await request(app).get(`/api/clubs/${club.id}`).set(auth(member.token));
    expect(hidden.status).toBe(404);

    const roster = await request(app).get(`/api/clubs/${club.id}/players`).set(auth(owner.token));
    const kept = roster.body.find((player: { id: number }) => player.id === before.id);
    expect(kept.userId).toBeNull();
    expect(kept.name).toBe(before.name);

    const reclaim = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(member.token))
      .send({ playerId: before.id });
    expect(reclaim.status).toBe(409);
    expect(reclaim.body.code).toBe("CLAIM_PENDING");

    const other = (await registerUser(app, 92)).body;
    const otherClaim = await request(app)
      .post(`/api/clubs/${club.inviteCode}/join`)
      .set(auth(other.token))
      .send({ playerId: before.id });
    expect(otherClaim.status).toBe(409);
    expect(otherClaim.body.code).toBe("CLAIM_PENDING");

    const accepted = await request(app)
      .post(`/api/claim-requests/${otherClaim.body.requestId}/resolve`)
      .set(auth(owner.token))
      .send({ decision: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.player.id).toBe(before.id);
    expect(accepted.body.player.userId).toBe(other.user.id);
  });

  it("lets the administrator remove a member without deleting their player", async () => {
    const { owner, users, club } = await createClubWithMembers(2);
    const member = users[1];
    const memberPlayer = (
      await request(app).get(`/api/clubs/${club.id}/players`).set(auth(owner.token))
    ).body.find((player: { userId: number | null }) => player.userId === member.user.id);

    const asMember = await request(app)
      .post(`/api/clubs/${club.id}/members/${member.user.id}/remove`)
      .set(auth(member.token));
    expect(asMember.status).toBe(403);
    expect(asMember.body.code).toBe("ADMIN_ONLY");

    const removeOwner = await request(app)
      .post(`/api/clubs/${club.id}/members/${owner.user.id}/remove`)
      .set(auth(owner.token));
    expect(removeOwner.status).toBe(409);
    expect(removeOwner.body.code).toBe("CANNOT_REMOVE_ADMIN");

    const removed = await request(app)
      .post(`/api/clubs/${club.id}/members/${member.user.id}/remove`)
      .set(auth(owner.token));
    expect(removed.status).toBe(200);
    expect(removed.body.player.id).toBe(memberPlayer.id);
    expect(removed.body.player.userId).toBeNull();
    expect(removed.body.club.participants).not.toContain(member.user.id);

    const roster = await request(app).get(`/api/clubs/${club.id}/players`).set(auth(owner.token));
    expect(roster.body.find((player: { id: number }) => player.id === memberPlayer.id).userId).toBeNull();
  });
});
