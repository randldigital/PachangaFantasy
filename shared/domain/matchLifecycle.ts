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
