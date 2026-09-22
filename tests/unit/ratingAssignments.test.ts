import { describe, expect, it } from "vitest";
import {
  assignMatchRatings,
  ballotMatchesAssignments,
  ratingsAreComplete,
} from "@shared/domain/ratingAssignments";

describe("assignMatchRatings", () => {
  it("gives each voter two teammates and two rivals on a full 5v5", () => {
    const teamA = [1, 2, 3, 4, 5];
    const teamB = [6, 7, 8, 9, 10];
    const assignments = assignMatchRatings({
      matchId: 10,
      teamA,
      teamB,
      voterPlayerIds: [...teamA, ...teamB],
      participantIds: [...teamA, ...teamB],
    });

    for (const voter of [...teamA, ...teamB]) {
      const outgoing = assignments.filter((row) => row.raterPlayerId === voter);
      expect(outgoing.filter((row) => row.kind === "teammate")).toHaveLength(2);
      expect(outgoing.filter((row) => row.kind === "rival")).toHaveLength(2);
    }
  });

  it("targets four incoming ratings per player when enough voters exist", () => {
    const teamA = [1, 2, 3, 4, 5];
    const teamB = [6, 7, 8, 9, 10];
    const assignments = assignMatchRatings({
      matchId: 11,
      teamA,
      teamB,
      voterPlayerIds: [...teamA, ...teamB],
      participantIds: [...teamA, ...teamB],
    });

    for (const playerId of [...teamA, ...teamB]) {
      const incoming = assignments.filter((row) => row.rateePlayerId === playerId);
      expect(incoming.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("lets guests be rated without making them voters", () => {
    const assignments = assignMatchRatings({
      matchId: 12,
      teamA: [1, 2, 99, 3, 4],
      teamB: [5, 6, 7, 8, 9],
      voterPlayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      participantIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 99],
    });

    expect(assignments.every((row) => row.raterPlayerId !== 99)).toBe(true);
    expect(assignments.filter((row) => row.rateePlayerId === 99).length).toBeGreaterThanOrEqual(2);
  });

  it("is stable for the same match id", () => {
    const input = {
      matchId: 44,
      teamA: [1, 2, 3, 4, 5],
      teamB: [6, 7, 8, 9, 10],
      voterPlayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      participantIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    };
    expect(assignMatchRatings(input)).toEqual(assignMatchRatings(input));
  });

  it("assigns rivals to fill the ballot when a voter has no teammate", () => {
    const assignments = assignMatchRatings({
      matchId: 8,
      teamA: [1],
      teamB: [2, 3, 4, 5],
      voterPlayerIds: [1, 2, 3, 4, 5],
      participantIds: [1, 2, 3, 4, 5],
    });
    const fromLone = assignments.filter((row) => row.raterPlayerId === 1);
    expect(fromLone.every((row) => row.kind === "rival")).toBe(true);
    expect(fromLone.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ratingsAreComplete", () => {
  it("requires every voter ballot", () => {
    expect(ratingsAreComplete([1, 2], [1])).toBe(false);
    expect(ratingsAreComplete([1, 2], [2, 1])).toBe(true);
    expect(ratingsAreComplete([], [])).toBe(true);
  });
});

describe("ballotMatchesAssignments", () => {
  it("requires exactly the assigned ratees", () => {
    const assignments = [
      { raterPlayerId: 1, rateePlayerId: 2, kind: "teammate" as const },
      { raterPlayerId: 1, rateePlayerId: 3, kind: "rival" as const },
    ];
    expect(ballotMatchesAssignments(1, [{ playerId: 3 }, { playerId: 2 }], assignments)).toBe(true);
    expect(ballotMatchesAssignments(1, [{ playerId: 2 }], assignments)).toBe(false);
  });
});
