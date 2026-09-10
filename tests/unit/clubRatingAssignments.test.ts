import { describe, expect, it } from "vitest";
import {
  CLUB_TARGET_INCOMING,
  assignClubRatings,
  incomingCounts,
} from "@shared/domain/clubRatingAssignments";

function ids(count: number, offset = 1): number[] {
  return Array.from({ length: count }, (_, index) => index + offset);
}

describe("club rating assignments", () => {
  it("gives every participant at least three incoming ratings", () => {
    const participantIds = ids(10);
    const assignments = assignClubRatings({
      matchId: 1,
      participantIds,
      voterPlayerIds: participantIds.slice(0, 7),
    });

    const counts = incomingCounts(assignments);
    for (const playerId of participantIds) {
      expect(counts.get(playerId) ?? 0).toBeGreaterThanOrEqual(CLUB_TARGET_INCOMING);
    }
  });

  it("covers externals who cannot vote themselves", () => {
    const participantIds = ids(8);
    const voterPlayerIds = participantIds.slice(0, 5);
    const assignments = assignClubRatings({ matchId: 2, participantIds, voterPlayerIds });

    const externals = participantIds.slice(5);
    const counts = incomingCounts(assignments);
    for (const external of externals) {
      expect(counts.get(external) ?? 0).toBeGreaterThanOrEqual(CLUB_TARGET_INCOMING);
    }
    expect(assignments.every((row) => voterPlayerIds.includes(row.raterPlayerId))).toBe(true);
  });

  it("never assigns a self-rating or a duplicate pair", () => {
    const participantIds = ids(9);
    const assignments = assignClubRatings({
      matchId: 3,
      participantIds,
      voterPlayerIds: participantIds.slice(0, 6),
    });

    expect(assignments.some((row) => row.raterPlayerId === row.rateePlayerId)).toBe(false);
    const pairs = assignments.map((row) => `${row.raterPlayerId}:${row.rateePlayerId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("makes a small squad rate everyone else rather than chase three", () => {
    const participantIds = ids(4);
    const voterPlayerIds = participantIds.slice(0, 3);
    const assignments = assignClubRatings({ matchId: 4, participantIds, voterPlayerIds });

    for (const voter of voterPlayerIds) {
      const rated = assignments
        .filter((row) => row.raterPlayerId === voter)
        .map((row) => row.rateePlayerId)
        .sort();
      expect(rated).toEqual(participantIds.filter((id) => id !== voter));
    }
  });

  it("is stable for the same match and squad", () => {
    const participantIds = ids(11);
    const input = { matchId: 5, participantIds, voterPlayerIds: participantIds.slice(0, 8) };
    expect(assignClubRatings(input)).toEqual(assignClubRatings(input));
  });

  it("allows uneven outgoing loads while keeping incoming coverage", () => {
    const participantIds = ids(11);
    const assignments = assignClubRatings({
      matchId: 6,
      participantIds,
      voterPlayerIds: participantIds.slice(0, 5),
    });

    const outgoing = new Map<number, number>();
    for (const row of assignments) {
      outgoing.set(row.raterPlayerId, (outgoing.get(row.raterPlayerId) ?? 0) + 1);
    }
    const loads = [...outgoing.values()];
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(2);

    const counts = incomingCounts(assignments);
    for (const playerId of participantIds) {
      expect(counts.get(playerId) ?? 0).toBeGreaterThanOrEqual(CLUB_TARGET_INCOMING);
    }
  });

  it("tolerates a squad with no registered voters", () => {
    expect(assignClubRatings({ matchId: 7, participantIds: ids(4), voterPlayerIds: [] })).toEqual([]);
  });
});
