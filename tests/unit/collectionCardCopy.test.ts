import { describe, expect, it } from "vitest";
import { hattrickKicker } from "@/components/collection/CollectionCard";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.count != null ? `${key}:${options.count}` : key;

describe("hat-trick card copy", () => {
  it("keeps the category label when the count is the artwork's three", () => {
    expect(hattrickKicker(3, t)).toBe("collection.badges.hattrick");
    expect(hattrickKicker(undefined, t)).toBe("collection.badges.hattrick");
  });

  it("shows the actual goal count when the player scored more than three", () => {
    expect(hattrickKicker(4, t)).toBe("collection.cards.hattrickGoals:4");
  });
});
