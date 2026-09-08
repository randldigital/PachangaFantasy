export type PersistedMatchStatus = "open" | "started" | "completed" | "scored";

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
  return normalized === "completed" || normalized === "scored";
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
