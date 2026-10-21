import { describe, expect, it } from "vitest";
import {
  hatTrickSourceKey,
  invalidationAction,
  matchFactCards,
  monthKey,
  monthRangeUtc,
  mvpSourceKey,
  pickPack,
  previousMonthKey,
  selectTotm,
  totmSourceKey,
  type TotmPerformance,
} from "@shared/domain/collection";

const official = {
  id: 18,
  isFriendly: false,
  status: "scored" as const,
  date: new Date("2026-05-10T16:00:00Z"),
  seasonKey: "2025/26",
  leagueId: 1,
  teamAGoals: 4,
  teamBGoals: 1,
};

function performance(partial: Partial<TotmPerformance> & Pick<TotmPerformance, "playerId" | "matchId" | "performanceScore">): TotmPerformance {
  return {
    mvp: 0.2,
    goals: 0,
    occurredAt: new Date("2020-01-15T18:00:00Z"),
    seasonKey: "2019/20",
    ...partial,
  };
}

describe("collection facts", () => {
  it("builds stable keys and skips friendlies and unfinished matches", () => {
    const cards = matchFactCards(
      official,
      [{ playerId: 7, goals: 3 }, { playerId: 8, goals: 2 }],
      [{ mvpPlayerId: 7 }, { mvpPlayerId: 7 }, { mvpPlayerId: 9 }],
    );
    expect(cards.map((card) => card.sourceKey)).toEqual([
      "match:18",
      mvpSourceKey(18, 7),
      hatTrickSourceKey(18, 7),
    ]);
    expect(cards.find((card) => card.cardType === "mvp")?.payload).toMatchObject({
      playerId: 7,
      teamAGoals: 4,
      teamBGoals: 1,
    });
    expect(cards.find((card) => card.cardType === "hattrick")?.payload).toMatchObject({
      goals: 3,
      teamAGoals: 4,
      teamBGoals: 1,
    });
    expect(matchFactCards({ ...official, isFriendly: true }, [{ playerId: 7, goals: 4 }], [{ mvpPlayerId: 7 }])).toEqual([]);
    expect(matchFactCards({ ...official, status: "completed" }, [{ playerId: 7, goals: 4 }], [{ mvpPlayerId: 7 }])).toEqual([]);
  });

  it("keeps an owned invalidated card and deletes an unowned one", () => {
    expect(invalidationAction(0)).toBe("delete");
    expect(invalidationAction(2)).toBe("error");
  });

  it("selects at most five distinct players, keeping each player's best night", () => {
    const rows = [
      performance({ playerId: 1, matchId: 10, performanceScore: 0.4, goals: 5 }),
      performance({ playerId: 1, matchId: 11, performanceScore: 0.95, goals: 1 }),
      performance({ playerId: 2, matchId: 12, performanceScore: 0.9 }),
      performance({ playerId: 3, matchId: 13, performanceScore: 0.8 }),
      performance({ playerId: 4, matchId: 14, performanceScore: 0.7 }),
      performance({ playerId: 5, matchId: 15, performanceScore: 0.6 }),
      performance({ playerId: 6, matchId: 16, performanceScore: 0.6, mvp: 0.1 }),
    ];
    const selected = selectTotm(rows);
    expect(selected).toHaveLength(5);
    expect(new Set(selected.map((row) => row.playerId)).size).toBe(5);
    expect(selected.find((row) => row.playerId === 1)?.matchId).toBe(11);
    expect(selected.map((row) => row.playerId)).not.toContain(6);
    expect(selectTotm([])).toEqual([]);
    expect(selectTotm(rows.slice(0, 2)).map((row) => totmSourceKey("2020-01", row.matchId, row.playerId))).toEqual([
      "totm:2020-01:11:1",
    ]);
  });
});

describe("collection packs", () => {
  const cards = [
    { id: 1, rarity: "common" as const, status: "active" as const },
    { id: 2, rarity: "common" as const, status: "active" as const },
    { id: 3, rarity: "rare" as const, status: "error" as const },
    { id: 4, rarity: "legendary" as const, status: "retired" as const },
  ];

  it("prefers unowned active cards and then allows duplicates", () => {
    const first = pickPack({ cards, ownedIds: [], random: () => 0 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(new Set(first.cardIds)).toEqual(new Set([1, 2]));

    const duplicate = pickPack({ cards, ownedIds: [1, 2], random: () => 0 });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.cardIds.every((id) => id === 1 || id === 2)).toBe(true);
  });

  it("ignores error and retired cards and reports an empty pool", () => {
    const draw = pickPack({
      cards: [
        { id: 3, rarity: "rare", status: "error" },
        { id: 4, rarity: "legendary", status: "retired" },
      ],
      ownedIds: [],
      random: () => 0.99,
    });
    expect(draw).toEqual({ ok: false, reason: "empty" });
  });
});

describe("collection calendar", () => {
  it("buckets instants in Europe/Madrid and covers the whole month", () => {
    expect(monthKey(new Date("2026-03-31T22:30:00.000Z"))).toBe("2026-04");
    expect(monthKey(new Date("2026-03-31T21:30:00.000Z"))).toBe("2026-03");
    expect(previousMonthKey(new Date("2026-10-21T12:00:00.000Z"))).toBe("2026-09");
    const range = monthRangeUtc("2026-03");
    expect(monthKey(range.start)).toBe("2026-03");
    expect(monthKey(new Date(range.end.getTime() - 1))).toBe("2026-03");
    expect(monthKey(range.end)).toBe("2026-04");
  });
});
