import { describe, expect, it } from "vitest";
import { pickStatsMatch } from "@shared/domain/stats";

describe("pickStatsMatch", () => {
  it("returns the latest finished match by date then id", () => {
    const matches = [
      { id: 9, status: "scored", date: "2026-09-15T19:00:00.000Z" },
      { id: 10, status: "scored", date: "2026-09-21T19:00:00.000Z" },
      { id: 11, status: "open", date: "2026-09-28T19:00:00.000Z" },
    ];
    expect(pickStatsMatch(matches)?.id).toBe(10);
  });

  it("prefers a newer completed match over an older scored one", () => {
    const matches = [
      { id: 1, status: "scored", date: "2026-09-01T12:00:00.000Z" },
      { id: 2, status: "completed", date: "2026-09-10T12:00:00.000Z" },
    ];
    expect(pickStatsMatch(matches)?.id).toBe(2);
  });

  it("returns undefined when nothing is finished", () => {
    expect(pickStatsMatch([{ id: 1, status: "open", date: "2026-09-01T12:00:00.000Z" }])).toBeUndefined();
  });
});
