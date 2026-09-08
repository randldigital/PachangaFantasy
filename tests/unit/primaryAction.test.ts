import { describe, expect, it } from "vitest";
import { nextPrimaryAction, type PrimaryActionInput } from "@shared/domain/primaryAction";

const base: PrimaryActionInput = {
  isAdmin: false,
  leagueStatus: "closed",
  playerCount: 4,
  userIsPlayer: true,
  userJoinedActiveMatch: false,
  hasSavedLineup: false,
  userPlayedStatsMatch: false,
  userSubmittedStats: false,
  statsCanScore: false,
};

describe("nextPrimaryAction", () => {
  it("asks a member without a player record to add themselves", () => {
    expect(nextPrimaryAction({ ...base, userIsPlayer: false }).id).toBe("add_myself");
  });

  it("asks the admin to add players when the roster is empty", () => {
    expect(nextPrimaryAction({ ...base, isAdmin: true, playerCount: 0 }).id).toBe("add_players");
  });

  it("opens valuation before anything else once players exist", () => {
    expect(nextPrimaryAction({ ...base, isAdmin: true, leagueStatus: "open" }).id).toBe("open_valuation");
    expect(nextPrimaryAction({ ...base, leagueStatus: "open" }).id).toBe("wait_for_valuation");
  });

  it("sends everyone to valuation while it is open", () => {
    expect(nextPrimaryAction({ ...base, leagueStatus: "voting" }).id).toBe("submit_valuation");
  });

  it("walks join → lineup → start while a match is open", () => {
    expect(nextPrimaryAction({ ...base, activeMatchStatus: "open" }).id).toBe("join_match");
    expect(
      nextPrimaryAction({ ...base, activeMatchStatus: "open", userJoinedActiveMatch: true }).id,
    ).toBe("build_lineup");
    expect(
      nextPrimaryAction({
        ...base,
        isAdmin: true,
        activeMatchStatus: "open",
        userJoinedActiveMatch: true,
        hasSavedLineup: true,
      }).id,
    ).toBe("start_match");
    expect(
      nextPrimaryAction({
        ...base,
        activeMatchStatus: "open",
        userJoinedActiveMatch: true,
        hasSavedLineup: true,
      }).id,
    ).toBe("wait_for_start");
  });

  it("asks the admin to end a started match", () => {
    expect(nextPrimaryAction({ ...base, isAdmin: true, activeMatchStatus: "started" }).id).toBe("end_match");
    expect(nextPrimaryAction({ ...base, activeMatchStatus: "started" }).id).toBe("wait_for_end");
  });

  it("asks participants to submit stats, then the admin to score", () => {
    expect(
      nextPrimaryAction({
        ...base,
        statsMatchStatus: "completed",
        userPlayedStatsMatch: true,
      }).id,
    ).toBe("submit_stats");
    expect(
      nextPrimaryAction({
        ...base,
        isAdmin: true,
        statsMatchStatus: "completed",
        userPlayedStatsMatch: true,
        userSubmittedStats: true,
        statsCanScore: true,
      }).id,
    ).toBe("score_match");
    expect(
      nextPrimaryAction({
        ...base,
        statsMatchStatus: "completed",
        userPlayedStatsMatch: true,
        userSubmittedStats: true,
      }).id,
    ).toBe("wait_for_stats");
  });

  it("creates the next match or shows standings when idle", () => {
    expect(nextPrimaryAction({ ...base, isAdmin: true }).id).toBe("create_match");
    expect(nextPrimaryAction({ ...base, statsMatchStatus: "scored" }).id).toBe("view_leaderboard");
    expect(nextPrimaryAction(base).id).toBe("wait_for_match");
  });
});
