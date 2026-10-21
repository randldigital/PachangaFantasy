import { describe, expect, it } from "vitest";
import { packCopyStatus } from "@/components/collection/PackReveal";

describe("pack copy status", () => {
  it("marks a first copy as new and a later copy with its resulting quantity", () => {
    const cards = [
      { id: 4, ownedQuantity: 1 },
      { id: 9, ownedQuantity: 3 },
    ];
    expect(packCopyStatus(cards, 0)).toEqual({ fresh: true, quantity: 1 });
    expect(packCopyStatus(cards, 1)).toEqual({ fresh: false, quantity: 3 });
  });

  it("counts two copies of the same card in order", () => {
    const cards = [
      { id: 4, ownedQuantity: 2 },
      { id: 4, ownedQuantity: 2 },
    ];
    expect(packCopyStatus(cards, 0)).toEqual({ fresh: true, quantity: 1 });
    expect(packCopyStatus(cards, 1)).toEqual({ fresh: false, quantity: 2 });
  });
});
