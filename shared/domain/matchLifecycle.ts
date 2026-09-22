/** Club matches add a terminal `closed`; Fantasy matches stop at `scored`. */
export type PersistedMatchStatus = "open" | "started" | "completed" | "scored" | "closed";

export function normalizeMatchStatus(status: string | null | undefined): PersistedMatchStatus | string {
  if (status === "ready") {
    return "started";
  }
  return status ?? "open";
}

export function isLineupEditable(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "open";
}

export function isJoinableStatus(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "open";
}

/** Missing/legacy rows behave as open. Distinct from league/club membership `joinOpen`. */
export function isMatchJoinOpen(match: { joinOpen?: boolean | null } | null | undefined): boolean {
  return match?.joinOpen !== false;
}

export function isActiveMatchStatus(status: string | null | undefined): boolean {
  const normalized = normalizeMatchStatus(status);
  return normalized === "open" || normalized === "started";
}

export function isFinishedStatus(status: string | null | undefined): boolean {
  const normalized = normalizeMatchStatus(status);
  return normalized === "completed" || normalized === "scored" || normalized === "closed";
}

/** A closed Club match rejects every further stat, rating and scoring write. */
export function isClosedStatus(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "closed";
}

export function canCloseMatch(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "scored";
}

export function canStartMatch(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "open";
}

export function canEndMatch(status: string | null | undefined): boolean {
  return normalizeMatchStatus(status) === "started";
}

export function hasActiveMatch(
  matches: { status: string | null }[],
): boolean {
  return matches.some((match) => isActiveMatchStatus(match.status));
}

export function pickActiveMatch<T extends { status: string | null }>(
  matches: T[],
): T | undefined {
  return matches.find((match) => isActiveMatchStatus(match.status));
}

/** Latest scored or closed match by date then id (Fantasy idle lineup / last manager score). */
export function pickLatestScoredMatch<
  T extends { id: number; date?: Date | string | null; status: string | null },
>(matches: T[]): T | undefined {
  const scored = matches
    .filter((match) => {
      const status = normalizeMatchStatus(match.status);
      return status === "scored" || status === "closed";
    })
    .sort((a, b) => {
      const byDate = new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
      if (byDate !== 0) {
        return byDate;
      }
      return b.id - a.id;
    });
  return scored[0];
}
