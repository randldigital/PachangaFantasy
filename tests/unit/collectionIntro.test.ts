import { describe, expect, it } from "vitest";
import { firstUnseenCollection, introSeenKey } from "@/components/collection/CollectionIntro";

describe("collection intro", () => {
  const leagues = [
    { id: 2, hasCollection: false },
    { id: 6, hasCollection: true },
    { id: 9, hasCollection: true },
  ];

  it("picks the first league whose collection the user has not seen", () => {
    expect(firstUnseenCollection(leagues, new Set(), 12)?.id).toBe(6);
    expect(firstUnseenCollection(leagues, new Set([introSeenKey(12, 6)]), 12)?.id).toBe(9);
    expect(firstUnseenCollection(leagues, new Set([introSeenKey(12, 6), introSeenKey(12, 9)]), 12)).toBeNull();
  });
});
