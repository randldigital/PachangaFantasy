import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import fs from "node:fs/promises";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import {
  collectionCards,
  collectionOwnership,
  collectionPackState,
  managerMatchPoints,
  matchMvpVotes,
  matchParticipants,
  matches,
  playerMarketValueHistory,
  playerMatchPoints,
  statReports,
  users,
} from "@shared/schema";
import { hatTrickSourceKey, matchSourceKey, mvpSourceKey, playerSourceKey } from "@shared/domain/collection";
import { createApp } from "../../server/app";
import { db } from "../../server/db";
import * as collectionRepo from "../../server/repos/collectionRepo";
import * as userRepo from "../../server/repos/userRepo";
import { ensureTestDatabase, resetTestSchema } from "../helpers/testDb";
import { auth, createLeagueWithMembers, listPlayers, registerUser } from "../helpers/fixtures";

const app = createApp();

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 20, g: 80, b: 40 } } }).jpeg().toBuffer();
}

describe("collection", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetTestSchema();
  });

  it("bootstraps official history, ignores friendlies, and does not rescan on read", async () => {
    const { users: members, owner, league } = await createLeagueWithMembers(app, 2);
    const roster = await listPlayers(app, owner.token, league.id);
    const scorer = roster[0];
    const other = roster[1];
    const pointsBefore = await db.select().from(playerMatchPoints);
    const managersBefore = await db.select().from(managerMatchPoints);
    const valueBefore = await db.select().from(playerMarketValueHistory);

    const [official] = await db.insert(matches).values({
      leagueId: league.id,
      date: new Date("2026-05-10T16:00:00Z"),
      status: "scored",
      isFriendly: false,
      createdBy: owner.user.id,
      seasonKey: "2025/26",
      teamAGoals: 3,
      teamBGoals: 1,
      sideSize: 5,
    }).returning();
    const [friendly] = await db.insert(matches).values({
      leagueId: league.id,
      date: new Date("2026-05-17T16:00:00Z"),
      status: "scored",
      isFriendly: true,
      createdBy: owner.user.id,
      seasonKey: "2025/26",
      teamAGoals: 5,
      teamBGoals: 0,
      sideSize: 5,
    }).returning();
    await db.insert(matchParticipants).values([
      { matchId: official.id, playerId: scorer.id, userId: scorer.userId, status: "accepted" },
      { matchId: friendly.id, playerId: scorer.id, userId: scorer.userId, status: "accepted" },
    ]);
    await db.insert(statReports).values([
      { matchId: official.id, playerId: scorer.id, goals: 3, assists: 0 },
      { matchId: friendly.id, playerId: scorer.id, goals: 4, assists: 0 },
    ]);
    await db.insert(matchMvpVotes).values([
      { matchId: official.id, voterPlayerId: other.id, mvpPlayerId: scorer.id },
      { matchId: friendly.id, voterPlayerId: other.id, mvpPlayerId: scorer.id },
    ]);

    const stranger = (await registerUser(app, 9)).body;
    const denied = await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(members[1].token));
    expect(denied.status).toBe(403);
    const hidden = await request(app).get(`/api/leagues/${league.id}/collection`).set(auth(stranger.token));
    expect(hidden.status).toBe(404);

    const created = await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token));
    expect(created.status).toBe(201);
    const again = await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token));
    expect(again.status).toBe(409);

    const album = await request(app).get(`/api/leagues/${league.id}/collection?limit=100`).set(auth(members[1].token));
    expect(album.status).toBe(200);
    const keys = album.body.cards.map((card: { sourceKey: string }) => card.sourceKey);
    expect(keys).toContain(playerSourceKey(scorer.id));
    expect(keys).toContain(playerSourceKey(other.id));
    expect(keys).toContain(matchSourceKey(official.id));
    expect(keys).toContain(mvpSourceKey(official.id, scorer.id));
    expect(keys).toContain(hatTrickSourceKey(official.id, scorer.id));
    expect(keys).not.toContain(matchSourceKey(friendly.id));
    expect(keys).not.toContain(mvpSourceKey(friendly.id, scorer.id));
    expect(keys).not.toContain(hatTrickSourceKey(friendly.id, scorer.id));
    expect(album.body.progress.existing).toBe(album.body.cards.length);
    expect(album.body.progress.owned).toBe(0);
    expect(album.body.progress.byType.reduce((sum: number, row: { existing: number }) => sum + row.existing, 0)).toBe(album.body.progress.existing);

    const [late] = await db.insert(matches).values({
      leagueId: league.id,
      date: new Date("2026-06-02T16:00:00Z"),
      status: "scored",
      isFriendly: false,
      createdBy: owner.user.id,
      seasonKey: "2025/26",
      teamAGoals: 1,
      teamBGoals: 0,
      sideSize: 5,
    }).returning();
    const beforePack = await request(app).get(`/api/leagues/${league.id}/collection?limit=100`).set(auth(owner.token));
    expect(beforePack.body.cards.map((card: { sourceKey: string }) => card.sourceKey)).not.toContain(matchSourceKey(late.id));
    const opened = await request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token));
    expect(opened.status).toBe(200);
    expect(opened.body.cards).toHaveLength(2);
    expect(opened.body.cards.every((card: { status: string }) => card.status === "active")).toBe(true);
    const afterPack = await request(app).get(`/api/leagues/${league.id}/collection?limit=100`).set(auth(owner.token));
    expect(afterPack.body.cards.map((card: { sourceKey: string }) => card.sourceKey)).not.toContain(matchSourceKey(late.id));

    await collectionRepo.syncMatch(late.id);
    const synced = await request(app).get(`/api/leagues/${league.id}/collection?limit=100`).set(auth(owner.token));
    expect(synced.body.cards.map((card: { sourceKey: string }) => card.sourceKey)).toContain(matchSourceKey(late.id));

    expect(await db.select().from(playerMatchPoints)).toEqual(pointsBefore);
    expect(await db.select().from(managerMatchPoints)).toEqual(managersBefore);
    expect(await db.select().from(playerMarketValueHistory)).toEqual(valueBefore);
  });

  it("deletes an unowned invalidated card and preserves an owned one as error", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    const roster = await listPlayers(app, owner.token, league.id);
    const scorer = roster[0];
    const other = roster[1];
    const [match] = await db.insert(matches).values({
      leagueId: league.id,
      date: new Date("2026-05-10T16:00:00Z"),
      status: "scored",
      isFriendly: false,
      createdBy: owner.user.id,
      seasonKey: "2025/26",
      teamAGoals: 3,
      teamBGoals: 0,
      sideSize: 5,
    }).returning();
    await db.insert(matchParticipants).values({ matchId: match.id, playerId: scorer.id, userId: scorer.userId, status: "accepted" });
    await db.insert(statReports).values({ matchId: match.id, playerId: scorer.id, goals: 3, assists: 0 });
    await db.insert(matchMvpVotes).values({ matchId: match.id, voterPlayerId: other.id, mvpPlayerId: scorer.id });
    expect((await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token))).status).toBe(201);

    const hatTrick = (await db.select().from(collectionCards).where(eq(collectionCards.sourceKey, hatTrickSourceKey(match.id, scorer.id))))[0];
    const collectionId = hatTrick.collectionId;
    await db.insert(collectionOwnership).values({
      collectionId,
      cardId: hatTrick.id,
      userId: owner.user.id,
      quantity: 2,
    });
    await db.update(matches).set({ isFriendly: true }).where(eq(matches.id, match.id));
    await collectionRepo.reconcileMatch(match.id);

    const album = await request(app).get(`/api/leagues/${league.id}/collection?limit=100`).set(auth(owner.token));
    const keys = album.body.cards.map((card: { sourceKey: string }) => card.sourceKey);
    expect(keys).not.toContain(matchSourceKey(match.id));
    expect(keys).not.toContain(mvpSourceKey(match.id, scorer.id));
    const stamped = album.body.cards.find((card: { sourceKey: string }) => card.sourceKey === hatTrickSourceKey(match.id, scorer.id));
    expect(stamped.status).toBe("error");
    expect(stamped.ownedQuantity).toBe(2);

    await db.update(collectionCards).set({ status: "retired" }).where(and(eq(collectionCards.collectionId, collectionId), eq(collectionCards.status, "active")));
    await db.update(collectionPackState).set({ nextPackAt: null }).where(eq(collectionPackState.collectionId, collectionId));
    const empty = await request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token));
    expect(empty.status).toBe(409);
    expect(empty.body.code).toBe("PACK_EMPTY");
    const stillThere = await db.select().from(collectionCards).where(eq(collectionCards.id, hatTrick.id));
    expect(stillThere[0]?.status).toBe("error");
    const quantity = await db.select().from(collectionOwnership).where(eq(collectionOwnership.cardId, hatTrick.id));
    expect(quantity[0]?.quantity).toBe(2);
  });

  it("opens one pack per day and increments quantity once a rarity is complete", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    expect((await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token))).status).toBe(201);
    const first = await request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token));
    const second = await request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token));
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("PACK_COOLDOWN");

    const collection = (await db.select().from(collectionCards))[0];
    await db.update(collectionPackState).set({ nextPackAt: null }).where(eq(collectionPackState.collectionId, collection.collectionId));
    const [left, right] = await Promise.all([
      request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token)),
      request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token)),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([200, 409]);

    await db.update(collectionPackState).set({ nextPackAt: null }).where(eq(collectionPackState.collectionId, collection.collectionId));
    const duplicate = await request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token));
    expect(duplicate.status).toBe(200);
    const owned = await db.select().from(collectionOwnership).where(eq(collectionOwnership.userId, owner.user.id));
    const total = owned.reduce((sum, row) => sum + row.quantity, 0);
    expect(total).toBe(6);
  });

  it("deletes an unowned extra and retires an owned one", async () => {
    const { users: members, owner, league } = await createLeagueWithMembers(app, 2);
    expect((await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token))).status).toBe(201);
    const image = await jpeg();
    const created = await request(app)
      .post(`/api/leagues/${league.id}/collection/extras`)
      .set(auth(owner.token))
      .field("title", "Balón viejo")
      .field("subtitle", "El de los domingos")
      .field("body", "Se pinchó en el minuto 80")
      .field("rarity", "common")
      .attach("image", image, "ball.jpg");
    expect(created.status).toBe(201);
    const stored = collectionRepo.extraImageFile(created.body.card.imagePath);
    expect(stored).toBeTruthy();
    const saved = await sharp(stored!).metadata();
    expect(saved.format).toBe("jpeg");
    expect(saved.width).toBe(256);
    expect(saved.height).toBe(256);
    expect((await fs.stat(stored!)).size).toBeLessThanOrEqual(80 * 1024);
    const forbidden = await request(app)
      .post(`/api/leagues/${league.id}/collection/extras`)
      .set(auth(members[1].token))
      .field("title", "No")
      .field("rarity", "common")
      .attach("image", image, "ball.jpg");
    expect(forbidden.status).toBe(403);

    const removed = await request(app).delete(`/api/collections/cards/${created.body.card.id}`).set(auth(owner.token));
    expect(removed.body.result).toBe("deleted");
    expect(await db.select().from(collectionCards).where(eq(collectionCards.id, created.body.card.id))).toHaveLength(0);

    const second = await request(app)
      .post(`/api/leagues/${league.id}/collection/extras`)
      .set(auth(owner.token))
      .field("title", "Trofeo")
      .field("rarity", "rare")
      .attach("image", image, "cup.jpg");
    const cardId = second.body.card.id as number;
    await db.insert(collectionOwnership).values({
      collectionId: second.body.card.collectionId,
      cardId,
      userId: members[1].user.id,
      quantity: 1,
    });
    const retired = await request(app).delete(`/api/collections/cards/${cardId}`).set(auth(owner.token));
    expect(retired.body.result).toBe("retired");
    const row = (await db.select().from(collectionCards).where(eq(collectionCards.id, cardId)))[0];
    expect(row.status).toBe("retired");
    const quantity = await db.select().from(collectionOwnership).where(eq(collectionOwnership.cardId, cardId));
    expect(quantity[0]?.quantity).toBe(1);

    await db.update(collectionCards).set({ status: "retired" }).where(eq(collectionCards.status, "active"));
    await db.update(collectionPackState).set({ nextPackAt: null }).where(eq(collectionPackState.userId, owner.user.id));
    const pack = await request(app).post(`/api/leagues/${league.id}/collection/packs/open`).set(auth(owner.token));
    expect(pack.status).toBe(409);
    expect(pack.body.code).toBe("PACK_EMPTY");
  });

  it("bumps the avatar version without rewriting card definitions", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    expect((await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token))).status).toBe(201);
    const before = await db.select().from(collectionCards);
    await userRepo.setAvatarPath(owner.user.id, "uploads/avatars/test.jpg");
    const after = await db.select().from(collectionCards);
    expect(after.map((card) => ({ id: card.id, sourceKey: card.sourceKey, imagePath: card.imagePath, payload: card.payload }))).toEqual(
      before.map((card) => ({ id: card.id, sourceKey: card.sourceKey, imagePath: card.imagePath, payload: card.payload })),
    );
    const [user] = await db.select().from(users).where(eq(users.id, owner.user.id));
    expect(user.avatarVersion).toBe(1);
    const album = await request(app).get(`/api/leagues/${league.id}/collection?limit=100`).set(auth(owner.token));
    const mine = album.body.cards.find((card: { userId: number | null }) => card.userId === owner.user.id);
    expect(mine.avatarVersion).toBe(1);
  });

  it("keeps one team-of-the-month slot per player", async () => {
    const { owner, league } = await createLeagueWithMembers(app, 2);
    const roster = await listPlayers(app, owner.token, league.id);
    const star = roster[0];
    const other = roster[1];
    const insertMatch = async (date: string) => {
      const [match] = await db.insert(matches).values({
        leagueId: league.id,
        date: new Date(date),
        status: "scored",
        isFriendly: false,
        createdBy: owner.user.id,
        seasonKey: "2019/20",
        teamAGoals: 2,
        teamBGoals: 0,
        sideSize: 5,
      }).returning();
      return match;
    };
    const best = await insertMatch("2020-01-12T18:00:00Z");
    const weaker = await insertMatch("2020-01-19T18:00:00Z");
    const otherMatch = await insertMatch("2020-01-26T18:00:00Z");
    const history = (matchId: number, playerId: number, performanceScore: number, goals: number) =>
      db.insert(playerMarketValueHistory).values({
        matchId,
        playerId,
        vmBefore: 18,
        vmAfter: 19,
        delta: 1,
        mvp: 0.4,
        peer: 0.5,
        offensive: 0.5,
        result: 0.5,
        performanceScore,
        rawChange: 1,
        multiplier: 1,
        adjustedContribution: 1,
        expectedContribution: 0.2,
        baseline: 5,
        ownTeamAvgVm: 18,
        oppTeamAvgVm: 18,
        mvpVotes: 1,
        peerAverage: 7,
        breakdown: {},
      }).then(() => db.insert(statReports).values({ matchId, playerId, goals, assists: 0 }));
    await history(best.id, star.id, 0.95, 1);
    await history(weaker.id, star.id, 0.4, 3);
    await history(otherMatch.id, other.id, 0.7, 0);

    expect((await request(app).post(`/api/leagues/${league.id}/collection`).set(auth(owner.token))).status).toBe(201);
    const monthCards = await db.select().from(collectionCards).where(eq(collectionCards.periodKey, "totm:2020-01"));
    expect(monthCards).toHaveLength(2);
    expect(new Set(monthCards.map((card) => card.playerId)).size).toBe(2);
    expect(monthCards.find((card) => card.playerId === star.id)?.matchId).toBe(best.id);
    expect(monthCards.some((card) => card.matchId === weaker.id)).toBe(false);
  });
});
