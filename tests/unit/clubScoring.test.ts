import { describe, expect, it } from "vitest";
import {
  CLUB_MVP_POINTS_PENDING,
  CLUB_RESULT_POINTS_PENDING,
  clubPlayerPoints,
  clubResultOf,
  minutesComponent,
} from "@shared/domain/clubScoring";

describe("club minutes component", () => {
  it("caps at five points from ninety minutes", () => {
    expect(minutesComponent(90)).toBe(5);
    expect(minutesComponent(120)).toBe(5);
    expect(minutesComponent(200)).toBe(5);
  });

  it("scales linearly below ninety minutes", () => {
    expect(minutesComponent(45)).toBe(2.5);
    expect(minutesComponent(18)).toBe(1);
    expect(minutesComponent(0)).toBe(0);
    expect(minutesComponent(null)).toBe(0);
  });
});

describe("club match result", () => {
  it("reads the result from our goals against the opponent", () => {
    expect(clubResultOf(3, 1)).toBe("win");
    expect(clubResultOf(1, 1)).toBe("draw");
    expect(clubResultOf(0, 2)).toBe("loss");
  });
});

describe("club player points", () => {
  it("adds peer average, goals ×3, assists ×2 and minutes", () => {
    const breakdown = clubPlayerPoints({
      peerAverage: 7,
      goals: 2,
      assists: 1,
      minutes: 90,
      result: "win",
      isMvp: false,
    });
    expect(breakdown.offensive).toBe(8);
    expect(breakdown.minutes).toBe(5);
    expect(breakdown.points).toBe(20);
  });

  it("leaves the unconfirmed result and MVP weights at zero", () => {
    expect(CLUB_RESULT_POINTS_PENDING).toBe(true);
    expect(CLUB_MVP_POINTS_PENDING).toBe(true);

    const base = { peerAverage: 6, goals: 0, assists: 0, minutes: 45 } as const;
    const lostAndAnonymous = clubPlayerPoints({ ...base, result: "loss", isMvp: false });
    const wonAndMvp = clubPlayerPoints({ ...base, result: "win", isMvp: true });

    expect(wonAndMvp.resultContribution).toBe(0);
    expect(wonAndMvp.mvpContribution).toBe(0);
    expect(wonAndMvp.points).toBe(lostAndAnonymous.points);
  });
});
