/**
 * Album sections for cards that already exist.
 * Unknown future types get their own section instead of joining the flat grid.
 * Empty sections are omitted by the caller.
 */
const CORE_SECTION: Record<string, string> = {
  player: "players",
  match: "matches",
  mvp: "awards",
  totm: "awards",
  hattrick: "performances",
  extra: "extras",
};

const SECTION_ORDER = ["players", "matches", "awards", "performances", "extras"];

export function sectionForCardType(cardType: string): string {
  return CORE_SECTION[cardType] ?? `type:${cardType}`;
}

export function groupAlbum<T extends { cardType: string }>(cards: T[]): { id: string; cards: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const card of cards) {
    const id = sectionForCardType(card.cardType);
    const list = buckets.get(id);
    if (list) {
      list.push(card);
    } else {
      buckets.set(id, [card]);
    }
  }
  const known = SECTION_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map((id) => ({
    id,
    cards: buckets.get(id) ?? [],
  }));
  const rest = [...buckets.keys()]
    .filter((id) => !SECTION_ORDER.includes(id))
    .sort()
    .map((id) => ({ id, cards: buckets.get(id) ?? [] }));
  return [...known, ...rest];
}

export function sectionTotals(
  byType: { cardType: string; owned: number; existing: number }[],
  sectionId: string,
): { owned: number; existing: number } {
  return byType.reduce(
    (totals, row) => {
      if (sectionForCardType(row.cardType) !== sectionId) {
        return totals;
      }
      return { owned: totals.owned + row.owned, existing: totals.existing + row.existing };
    },
    { owned: 0, existing: 0 },
  );
}
