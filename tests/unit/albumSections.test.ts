import { describe, expect, it } from "vitest";
import { groupAlbum, sectionForCardType, sectionTotals } from "@/components/collection/albumSections";

describe("album sections", () => {
  it("groups core cards and hides empty sections", () => {
    const sections = groupAlbum([
      { cardType: "player", id: 1 },
      { cardType: "mvp", id: 2 },
      { cardType: "totm", id: 3 },
      { cardType: "hattrick", id: 4 },
      { cardType: "match", id: 5 },
    ]);
    expect(sections.map((section) => section.id)).toEqual(["players", "matches", "awards", "performances"]);
    expect(sections.find((section) => section.id === "awards")?.cards).toHaveLength(2);
    expect(sections.some((section) => section.id === "extras")).toBe(false);
  });

  it("gives a future card type its own section", () => {
    expect(sectionForCardType("record")).toBe("type:record");
    const sections = groupAlbum([{ cardType: "record", id: 1 }]);
    expect(sections).toEqual([{ id: "type:record", cards: [{ cardType: "record", id: 1 }] }]);
  });

  it("sums unique ownership for a section", () => {
    expect(
      sectionTotals(
        [
          { cardType: "mvp", owned: 2, existing: 5 },
          { cardType: "totm", owned: 1, existing: 4 },
          { cardType: "player", owned: 8, existing: 10 },
        ],
        "awards",
      ),
    ).toEqual({ owned: 3, existing: 9 });
  });
});
