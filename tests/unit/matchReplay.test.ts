import { describe, expect, it } from "vitest";
import { canReopenMatchStats, isLatestFinishedMatch, scoredReplayChain } from "@shared/domain/matchReplay";

function match(
  id: number,
  status: string,
  date: string,
): { id: number; date: string; status: string | null } {
  return { id, date, status };
}

describe("match replay helpers", () => {
  const first = match(1, "scored", "2026-03-01T12:00:00.000Z");
  const second = match(2, "scored", "2026-04-01T12:00:00.000Z");
  const laterOpen = match(3, "open", "2026-05-01T12:00:00.000Z");
  const laterCompleted = match(4, "completed", "2026-05-01T12:00:00.000Z");

  it("chains scored matches from this one onward by date then id", () => {
    expect(scoredReplayChain([second, first, laterOpen], first).map((row) => row.id)).toEqual([1, 2]);
  });

  it("treats the last finished match as latest even if a later match is still open", () => {
    const matches = [first, second, laterOpen];
    expect(isLatestFinishedMatch(matches, second)).toBe(true);
    expect(canReopenMatchStats(matches, second)).toBe(true);
    expect(canReopenMatchStats(matches, first)).toBe(false);
  });

  it("blocks reopen when a later match is already completed or scored", () => {
    expect(canReopenMatchStats([first, laterCompleted], first)).toBe(false);
    expect(isLatestFinishedMatch([first, laterCompleted], laterCompleted)).toBe(true);
    expect(canReopenMatchStats([first, laterCompleted], laterCompleted)).toBe(false);
  });

  it("does not reopen a match that is still collecting stats", () => {
    expect(canReopenMatchStats([laterCompleted], laterCompleted)).toBe(false);
  });

  it("allows reopening a closed club match when it is the last finished one", () => {
    const closed = match(8, "closed", "2026-06-01T12:00:00.000Z");
    expect(canReopenMatchStats([closed], closed)).toBe(true);
  });
});
