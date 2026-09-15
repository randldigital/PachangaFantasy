import { describe, expect, it } from "vitest";
import {
  canEndMatch,
  canStartMatch,
  hasActiveMatch,
  isJoinableStatus,
  isLineupEditable,
  isMatchJoinOpen,
  normalizeMatchStatus,
  pickActiveMatch,
} from "@shared/domain/matchLifecycle";

describe("match lifecycle", () => {
  it("treats legacy ready as started", () => {
    expect(normalizeMatchStatus("ready")).toBe("started");
    expect(isJoinableStatus("ready")).toBe(false);
    expect(isLineupEditable("ready")).toBe(false);
  });

  it("locks joining and lineups after start", () => {
    expect(isJoinableStatus("open")).toBe(true);
    expect(isLineupEditable("open")).toBe(true);
    expect(isJoinableStatus("started")).toBe(false);
    expect(isLineupEditable("started")).toBe(false);
    expect(canStartMatch("open")).toBe(true);
    expect(canEndMatch("open")).toBe(false);
    expect(canEndMatch("started")).toBe(true);
  });

  it("finds at most one Open or Started match", () => {
    expect(hasActiveMatch([{ status: "completed" }, { status: "scored" }])).toBe(false);
    expect(hasActiveMatch([{ status: "open" }])).toBe(true);
    expect(hasActiveMatch([{ status: "started" }])).toBe(true);
    expect(pickActiveMatch([{ status: "completed" }, { status: "open" }])?.status).toBe("open");
  });

  it("treats a missing joinOpen flag as open", () => {
    expect(isMatchJoinOpen(undefined)).toBe(true);
    expect(isMatchJoinOpen({ joinOpen: true })).toBe(true);
    expect(isMatchJoinOpen({ joinOpen: false })).toBe(false);
  });
});
