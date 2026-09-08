import { describe, expect, it } from "vitest";
import { LINEUP_SIZE, lineupCanSave, lineupTotalCost, validateLineup } from "@shared/domain/lineup";

const players = [1, 2, 3, 4, 5].map((id) => ({ id, marketValue: 18 }));

describe("validateLineup", () => {
  it("accepts a legal five-B lineup at budget 100", () => {
    const violations = validateLineup({
      playerIds: [1, 2, 3, 4, 5],
      captainId: 1,
      budget: 100,
      players,
      participantIds: [1, 2, 3, 4, 5],
      matchStatus: "open",
    });
    expect(violations).toEqual([]);
  });

  it("rejects the wrong size, duplicates, missing captain, and captain outside the five", () => {
    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4],
        captainId: 1,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4, 5],
      }).map((item) => item.code),
    ).toContain("LINEUP_SIZE");

    expect(
      validateLineup({
        playerIds: [1, 1, 2, 3, 4],
        captainId: 1,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4, 5],
      }).map((item) => item.code),
    ).toContain("LINEUP_UNIQUE");

    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: null,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4, 5],
      }).map((item) => item.code),
    ).toContain("LINEUP_CAPTAIN_REQUIRED");

    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 99,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4, 5],
      }).map((item) => item.code),
    ).toContain("LINEUP_CAPTAIN_NOT_IN_LINEUP");
  });

  it("rejects a 101-cost lineup at budget 100 and accepts five B (90)", () => {
    const pricey = [
      { id: 1, marketValue: 30 },
      { id: 2, marketValue: 24 },
      { id: 3, marketValue: 18 },
      { id: 4, marketValue: 18 },
      { id: 5, marketValue: 11 },
    ];
    expect(lineupTotalCost([1, 2, 3, 4, 5], pricey)).toBe(101);
    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players: pricey,
        participantIds: [1, 2, 3, 4, 5],
      }).map((item) => item.code),
    ).toContain("LINEUP_OVER_BUDGET");

    expect(lineupTotalCost([1, 2, 3, 4, 5], players)).toBe(90);
    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4, 5],
      }),
    ).toEqual([]);
  });

  it("rejects non-participants and over-budget lineups", () => {
    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4],
      }).map((item) => item.code),
    ).toContain("LINEUP_NOT_PARTICIPANT");

    const stars = [1, 2, 3, 4, 5].map((id) => ({ id, marketValue: 30 }));
    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players: stars,
        participantIds: [1, 2, 3, 4, 5],
      }).map((item) => item.code),
    ).toContain("LINEUP_OVER_BUDGET");
  });

  it("rejects saves after the match starts", () => {
    expect(
      validateLineup({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players,
        participantIds: [1, 2, 3, 4, 5],
        matchStatus: "started",
      }).map((item) => item.code),
    ).toContain("LINEUP_LOCKED");
  });

  it("keeps lineupCanSave true for five B and false for five S", () => {
    expect(LINEUP_SIZE).toBe(5);
    expect(
      lineupCanSave({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players,
        matchStatus: "open",
      }),
    ).toBe(true);
    expect(
      lineupCanSave({
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        budget: 100,
        players: [1, 2, 3, 4, 5].map((id) => ({ id, marketValue: 30 })),
        matchStatus: "open",
      }),
    ).toBe(false);
  });
});
