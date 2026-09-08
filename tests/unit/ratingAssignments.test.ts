import { describe, expect, it } from "vitest";
import {
  assignMatchRatings,
  ballotMatchesAssignments,
  ratingsAreComplete,
} from "@shared/domain/ratingAssignments";

describe("assignMatchRatings", () => {
  it("gives each voter a teammate and a rival when both exist", () => {
    const assignments = assignMatchRatings({
      matchId: 10,
      teamA: [1, 2, 3],
      teamB: [4, 5, 6],
      voterPlayerIds: [1, 2, 3, 4, 5, 6],
      participantIds: [1, 2, 3, 4, 5, 6],
    });

    for (const voter of [1, 2, 3, 4, 5, 6]) {
      const outgoing = assignments.filter((row) => row.raterPlayerId === voter);
      expect(outgoing.some((row) => row.kind === "teammate")).toBe(true);
      expect(outgoing.some((row) => row.kind === "rival")).toBe(true);
    }
  });

  it("targets two incoming ratings per player when enough voters exist", () => {
    const assignments = assignMatchRatings({
      matchId: 11,
      teamA: [1, 2, 3],
      teamB: [4, 5],
      voterPlayerIds: [1, 2, 3, 4, 5],
      participantIds: [1, 2, 3, 4, 5],
    });

    for (const playerId of [1, 2, 3, 4, 5]) {
      const incoming = assignments.filter((row) => row.rateePlayerId === playerId);
      expect(incoming.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("lets guests be rated without making them voters", () => {
    const assignments = assignMatchRatings({
      matchId: 12,
      teamA: [1, 2, 99],
      teamB: [3, 4],
      voterPlayerIds: [1, 2, 3, 4],
      participantIds: [1, 2, 3, 4, 99],
    });

    expect(assignments.every((row) => row.raterPlayerId !== 99)).toBe(true);
    expect(assignments.filter((row) => row.rateePlayerId === 99).length).toBeGreaterThanOrEqual(2);
  });

  it("is stable for the same match id", () => {
    const input = {
      matchId: 44,
      teamA: [1, 2],
      teamB: [3, 4],
      voterPlayerIds: [1, 2, 3, 4],
      participantIds: [1, 2, 3, 4],
    };
    expect(assignMatchRatings(input)).toEqual(assignMatchRatings(input));
  });

  it("assigns two rivals when a voter has no teammate", () => {
    const assignments = assignMatchRatings({
      matchId: 8,
      teamA: [1],
      teamB: [2, 3, 4],
      voterPlayerIds: [1, 2, 3, 4],
      participantIds: [1, 2, 3, 4],
    });
    const fromLone = assignments.filter((row) => row.raterPlayerId === 1);
    expect(fromLone.every((row) => row.kind === "rival")).toBe(true);
    expect(fromLone.length).toBeGreaterThanOrEqual(2);
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
