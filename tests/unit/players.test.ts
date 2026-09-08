import { describe, expect, it } from "vitest";
import { uniqueLeaguePlayerName } from "@shared/domain/players";

describe("uniqueLeaguePlayerName", () => {
  it("keeps the original name when it is free", () => {
    expect(uniqueLeaguePlayerName("Carlos", ["Lucia"])).toBe("Carlos");
  });

  it("suffixes (2), (3) on case-insensitive collision", () => {
    expect(uniqueLeaguePlayerName("Carlos", ["carlos"])).toBe("Carlos (2)");
    expect(uniqueLeaguePlayerName("Carlos", ["Carlos", "Carlos (2)"])).toBe("Carlos (3)");
  });
});
