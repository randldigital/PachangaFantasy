import { describe, expect, it } from "vitest";
import { cardHero, factDetail, hattrickKicker, heroTextSize, matchOutcome } from "@/components/collection/CollectionCard";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.count != null ? `${key}:${options.count}` : key;

describe("hat-trick card copy", () => {
  it("shows the goal count on the type line, including a hat-trick of three", () => {
    expect(hattrickKicker(3, t)).toBe("collection.cards.hattrickGoals:3");
    expect(hattrickKicker(4, t)).toBe("collection.cards.hattrickGoals:4");
    expect(hattrickKicker(undefined, t)).toBe("collection.badges.hattrick");
  });
});

describe("card hero", () => {
  it("picks the number and label for each player card", () => {
    expect(cardHero({ cardType: "mvp", points: 20.2, payload: {} }, "en")).toEqual({
      value: "20.2",
      labelKey: "collection.cards.heroPoints",
    });
    expect(cardHero({ cardType: "hattrick", points: 19.3, payload: { goals: 3 } }, "en")).toEqual({
      value: "19.3",
      labelKey: "collection.cards.heroPoints",
    });
    expect(cardHero({ cardType: "totm", points: 40.5, payload: { rank: 1 } }, "en")).toEqual({
      value: "40.5",
      labelKey: "collection.cards.heroPoints",
    });
    expect(cardHero({ cardType: "player", marketValue: 8, payload: {} }, "es")).toEqual({
      value: "8",
      labelKey: "collection.cards.heroValue",
    });
    expect(cardHero({ cardType: "player", marketValue: null, payload: {} }, "en")).toBeNull();
    expect(cardHero({ cardType: "mvp", points: null, payload: {} }, "en")).toBeNull();
  });

  it("lists goals, assists, side, and the value change, skipping empty counts", () => {
    expect(factDetail({ cardType: "mvp", goals: 1, assists: 0, side: "blue", valueDelta: 0.4 }, "en", t)).toBe(
      "collection.cards.goalOne · match.teamBShort · +0.4",
    );
    expect(factDetail({ cardType: "hattrick", goals: 3, assists: 0, side: "blue", valueDelta: 1 }, "en", t)).toBe(
      "match.teamBShort · +1",
    );
    expect(factDetail({ cardType: "mvp", goals: 0, assists: 2, side: "red", valueDelta: -1 }, "es", t)).toBe(
      "collection.cards.assistLine:2 · match.teamAShort · -1",
    );
  });

  it("names a win, a loss, or a draw from the player's side", () => {
    const score = { teamBGoals: 2, teamAGoals: 3 };
    expect(matchOutcome({ side: "red", payload: score }, t)).toBe("collection.cards.victory");
    expect(matchOutcome({ side: "blue", payload: score }, t)).toBe("collection.cards.defeat");
    expect(matchOutcome({ side: "blue", payload: { teamBGoals: 3, teamAGoals: 3 } }, t)).toBe("collection.cards.draw");
  });

  it("keeps the shield number the same size with or without a decimal", () => {
    const shield = { left: "4%", top: "11.5%", width: "12%", height: "8.5%" };
    const whole = heroTextSize("13", shield);
    const decimal = heroTextSize("15,5", shield);
    expect(decimal.value).toBe(whole.value);
    expect(decimal.label).toBe(whole.label);
    expect(heroTextSize("8", shield).value).toBe(whole.value);
  });
});
