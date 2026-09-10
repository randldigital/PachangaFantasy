import { describe, expect, it } from "vitest";
import {
  buildInviteCode,
  isValidInviteCode,
  parseInviteCode,
} from "@shared/domain/inviteCodes";

describe("parseInviteCode", () => {
  it("routes an L- code to a league", () => {
    expect(parseInviteCode("L-AB12CD")).toEqual({
      context: "league",
      code: "L-AB12CD",
      legacy: false,
    });
  });

  it("routes a C- code to a club", () => {
    expect(parseInviteCode("c-ab12cd")).toEqual({
      context: "club",
      code: "C-AB12CD",
      legacy: false,
    });
  });

  it("treats a bare six-character code as a legacy league code", () => {
    expect(parseInviteCode("AB12CD")).toEqual({
      context: "league",
      code: "AB12CD",
      legacy: true,
    });
  });

  it("accepts the old nanoid alphabet in legacy codes", () => {
    expect(parseInviteCode("AB-2_D")?.context).toBe("league");
  });

  it("never resolves an unprefixed code to a club", () => {
    const codes = ["AB12CD", "C12345", "L12345"];
    for (const code of codes) {
      expect(parseInviteCode(code)?.context).toBe("league");
    }
  });

  it("rejects malformed codes", () => {
    expect(parseInviteCode("L-AB12C")).toBeNull();
    expect(parseInviteCode("X-AB12CD")).toBeNull();
    expect(parseInviteCode("TOOLONGCODE")).toBeNull();
    expect(isValidInviteCode("")).toBe(false);
  });
});

describe("buildInviteCode", () => {
  it("prefixes new codes by context", () => {
    expect(buildInviteCode("league", "ab12cd")).toBe("L-AB12CD");
    expect(buildInviteCode("club", "ab12cd")).toBe("C-AB12CD");
  });

  it("produces codes the parser accepts", () => {
    expect(parseInviteCode(buildInviteCode("club", "ZZ9911"))?.context).toBe("club");
  });
});
