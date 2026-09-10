import { describe, expect, it } from "vitest";
import {
  currentSeasonKey,
  groupBySeason,
  isSeasonKey,
  seasonOf,
  seasonRange,
  sortSeasonKeysDescending,
} from "@shared/domain/season";

describe("seasonOf", () => {
  it("starts a season on 1 August", () => {
    expect(seasonOf(new Date(2026, 7, 1))).toBe("2026/27");
    expect(seasonOf(new Date(2026, 11, 31))).toBe("2026/27");
  });

  it("keeps January to July inside the season that started the previous August", () => {
    expect(seasonOf(new Date(2027, 0, 15))).toBe("2026/27");
    expect(seasonOf(new Date(2027, 6, 31))).toBe("2026/27");
  });

  it("rolls over on 1 August", () => {
    expect(seasonOf(new Date(2027, 7, 1))).toBe("2027/28");
  });

  it("pads the end year across a century boundary", () => {
    expect(seasonOf(new Date(2099, 8, 1))).toBe("2099/00");
  });

  it("rejects invalid dates", () => {
    expect(() => seasonOf("not a date")).toThrow();
  });
});

describe("season helpers", () => {
  it("bounds a season at 31 July 23:59", () => {
    const { start, end } = seasonRange("2026/27");
    expect(start).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
    expect(end.getMonth()).toBe(6);
    expect(end.getFullYear()).toBe(2027);
  });

  it("recognises season keys", () => {
    expect(isSeasonKey("2026/27")).toBe(true);
    expect(isSeasonKey("2026")).toBe(false);
    expect(isSeasonKey(2026)).toBe(false);
  });

  it("orders seasons newest first", () => {
    expect(sortSeasonKeysDescending(["2024/25", "2026/27", "2025/26"])).toEqual([
      "2026/27",
      "2025/26",
      "2024/25",
    ]);
  });

  it("groups items into season sections, newest first", () => {
    const groups = groupBySeason(
      [
        { id: 1, date: new Date(2026, 8, 1) },
        { id: 2, date: new Date(2027, 5, 1) },
        { id: 3, date: new Date(2025, 8, 1) },
      ],
      (item) => seasonOf(item.date),
    );
    expect(groups.map((group) => group.season)).toEqual(["2026/27", "2025/26"]);
    expect(groups[0].items.map((item) => item.id)).toEqual([1, 2]);
  });

  it("reports the season containing today", () => {
    expect(isSeasonKey(currentSeasonKey())).toBe(true);
  });
});
