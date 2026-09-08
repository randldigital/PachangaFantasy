import { describe, expect, it } from "vitest";
import { teamsAreComplete, validateMatchTeams } from "@shared/domain/teams";

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
