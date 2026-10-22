/**
 * Safe areas for every collection frame, as percentages of the 5:7 card.
 * Values are the visible card after the frame image is object-cover cropped,
 * so a frame that is not 5:7 still lines up. The portrait sits under the frame.
 * Plate text sits above it, clipped to the bay so it cannot cover the metal.
 */

export type SafeBox = {
  top: string;
  height: string;
  left: string;
  right: string;
};

export type HeroBox = {
  left: string;
  top: string;
  width: string;
  height: string;
};

export type FrameSafeArea = {
  src: string;
  portrait: SafeBox;
  name: SafeBox;
  facts: SafeBox;
  hero?: HeroBox;
  /** Painted center of a match frame. There is no photo window. */
  center?: SafeBox;
};

function bay(top: string, height: string, inset = "18%"): SafeBox {
  return { top, height, left: inset, right: inset };
}

function window(top: string, height: string, left: string, right: string): SafeBox {
  return { top, height, left, right };
}

export const FRAME_LAYOUT: Record<string, FrameSafeArea> = {
  player: {
    src: "/collection/frames/base.png",
    portrait: window("8%", "66%", "10%", "9%"),
    hero: { left: "4%", top: "11.5%", width: "12%", height: "8.5%" },
    name: bay("77.2%", "6.4%"),
    facts: bay("85.2%", "4%"),
  },
  mvp: {
    src: "/collection/frames/mvp.png",
    portrait: window("8.1%", "60.9%", "9%", "9%"),
    hero: { left: "3.2%", top: "11.2%", width: "12.6%", height: "11%" },
    name: bay("72%", "8.4%"),
    facts: bay("82.2%", "6.4%"),
  },
  hattrick: {
    src: "/collection/frames/hattrick.png",
    portrait: window("11%", "60.5%", "8.5%", "8.5%"),
    hero: { left: "11%", top: "12.2%", width: "14%", height: "8.6%" },
    name: bay("73.4%", "6.4%"),
    facts: bay("81.6%", "5.6%"),
  },
  totm: {
    src: "/collection/frames/totm.png",
    portrait: window("8.2%", "61.8%", "9%", "9%"),
    hero: { left: "6.5%", top: "15.5%", width: "12.2%", height: "7.4%" },
    name: bay("73.4%", "8.2%"),
    facts: bay("83%", "5.2%"),
  },
  match: {
    src: "/collection/frames/match.png",
    portrait: window("0%", "0%", "0%", "0%"),
    name: bay("0%", "0%"),
    facts: bay("0%", "0%"),
    center: bay("34%", "28%", "18%"),
  },
  extra: {
    src: "/collection/frames/extra.png",
    portrait: window("7.4%", "66.8%", "7.5%", "7.5%"),
    name: bay("73.8%", "5%"),
    facts: bay("82.9%", "6.9%"),
  },
};

const EXTRA_TINT: Record<string, string | undefined> = {
  common: undefined,
  rare: "url(#extra-tint-rare)",
  epic: "url(#extra-tint-epic)",
  legendary: "url(#extra-tint-legendary)",
};

export function frameSrc(cardType: string): string | undefined {
  return FRAME_LAYOUT[cardType]?.src;
}

export function extraFrameTint(rarity: string): string | undefined {
  return EXTRA_TINT[rarity];
}

export function boxStyle(box: SafeBox): { top: string; height: string; left: string; right: string } {
  return { top: box.top, height: box.height, left: box.left, right: box.right };
}
