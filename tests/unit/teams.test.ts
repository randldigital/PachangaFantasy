import { describe, expect, it } from "vitest";
import {
  matchCapacity,
  recommendMatchTeams,
  SIDE_SIZES,
  sideSizeOf,
  teamsAreComplete,
  validateMatchTeams,
} from "@shared/domain/teams";
import { LINEUP_SIZE } from "@shared/domain/lineup";

describe("validateMatchTeams", () => {
  it("requires two non-empty teams that partition the participants", () => {
    expect(validateMatchTeams({ participantIds: [1, 2, 3], teamA: [1], teamB: [2, 3] })).toEqual([]);
    expect(
      validateMatchTeams({ participantIds: [1, 2], teamA: [], teamB: [] }).map((item) => item.code),
    ).toContain("TEAMS_REQUIRED");
    expect(
      validateMatchTeams({ participantIds: [1, 2], teamA: [1], teamB: [] }).map((item) => item.code),
    ).toContain("TEAMS_EMPTY");
    expect(
      validateMatchTeams({ participantIds: [1, 2, 3], teamA: [1, 2], teamB: [2, 3] }).map((item) => item.code),
    ).toContain("TEAMS_OVERLAP");
    expect(
      validateMatchTeams({ participantIds: [1, 2, 3], teamA: [1], teamB: [2] }).map((item) => item.code),
    ).toContain("TEAMS_NOT_PARTITION");
  });

  it("treats a saved partition as complete", () => {
    expect(teamsAreComplete({ teamA: [1], teamB: [2] }, [1, 2])).toBe(true);
    expect(teamsAreComplete(null, [1, 2])).toBe(false);
  });
});

describe("side size", () => {
  const ids = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => from + index);

  it("defaults matches without a stored size to 5v5", () => {
    expect(sideSizeOf(null)).toBe(5);
    expect(sideSizeOf({ sideSize: null })).toBe(5);
    expect(sideSizeOf({ sideSize: 99 })).toBe(5);
    expect(sideSizeOf({ sideSize: 11 })).toBe(11);
  });

  it("derives capacity from the side size", () => {
    expect(matchCapacity(5)).toBe(10);
    expect(matchCapacity(7)).toBe(14);
    expect(matchCapacity(11)).toBe(22);
  });

  it("accepts exactly sideSize per side", () => {
    for (const size of SIDE_SIZES) {
      const teamA = ids(1, size);
      const teamB = ids(1 + size, size);
      expect(
        validateMatchTeams({
          participantIds: [...teamA, ...teamB],
          teamA,
          teamB,
          sideSize: size,
          requireFullSides: true,
        }),
      ).toEqual([]);
    }
  });

  it("rejects an eighth player on one side of a 7v7", () => {
    const teamA = ids(1, 8);
    const teamB = ids(9, 6);
    expect(
      validateMatchTeams({
        participantIds: [...teamA, ...teamB],
        teamA,
        teamB,
        sideSize: 7,
      }).map((item) => item.code),
    ).toContain("SIDE_OVER_CAPACITY");
  });

  it("allows a seventh player on one side of a 7v7", () => {
    const teamA = ids(1, 7);
    const teamB = ids(8, 6);
    expect(
      validateMatchTeams({
        participantIds: [...teamA, ...teamB],
        teamA,
        teamB,
        sideSize: 7,
      }),
    ).toEqual([]);
  });

  it("blocks the start until both sides are exactly full", () => {
    const teamA = ids(1, 7);
    const teamB = ids(8, 6);
    expect(
      validateMatchTeams({
        participantIds: [...teamA, ...teamB],
        teamA,
        teamB,
        sideSize: 7,
        requireFullSides: true,
      }).map((item) => item.code),
    ).toContain("SIDE_INCOMPLETE");
  });

  it("keeps the lineup at five even on an 11v11", () => {
    expect(LINEUP_SIZE).toBe(5);
    const teamA = ids(1, 11);
    const teamB = ids(12, 11);
    expect(
      teamsAreComplete({ teamA, teamB }, [...teamA, ...teamB], 11),
    ).toBe(true);
  });
});

describe("recommendMatchTeams", () => {
  it("balances sides by market value and fills A first on a tie", () => {
    const marketValue: Record<number, number> = {
      1: 30,
      2: 28,
      3: 24,
      4: 22,
      5: 20,
      6: 18,
      7: 16,
      8: 14,
      9: 12,
      10: 8,
    };
    const recommended = recommendMatchTeams({
      participantIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      marketValue,
      sideSize: 5,
    });
    expect(recommended.teamA).toEqual([1, 4, 5, 8, 9]);
    expect(recommended.teamB).toEqual([2, 3, 6, 7, 10]);
  });

  it("respects sideSize and leaves extras unassigned", () => {
    const participantIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const marketValue = Object.fromEntries(participantIds.map((id) => [id, 18]));
    const recommended = recommendMatchTeams({
      participantIds,
      marketValue,
      sideSize: 5,
    });
    expect(recommended.teamA.length).toBe(5);
    expect(recommended.teamB.length).toBe(5);
    const seated = new Set([...recommended.teamA, ...recommended.teamB]);
    expect(seated.size).toBe(10);
    expect(seated.has(11)).toBe(false);
    expect(seated.has(12)).toBe(false);
  });

  it("breaks equal values by player id", () => {
    const recommended = recommendMatchTeams({
      participantIds: [5, 3, 1, 4, 2],
      marketValue: { 1: 18, 2: 18, 3: 18, 4: 18, 5: 18 },
      sideSize: 5,
    });
    expect(recommended.teamA[0]).toBe(1);
    expect(recommended.teamB[0]).toBe(2);
  });
});
