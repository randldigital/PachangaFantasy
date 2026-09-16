import { isFinishedStatus, normalizeMatchStatus } from "./matchLifecycle";

function compareByDateThenId(
  a: { id: number; date: Date | string },
  b: { id: number; date: Date | string },
): number {
  const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (byDate !== 0) {
    return byDate;
  }
  return a.id - b.id;
}

/** Scored (or club-closed) matches from this one onward, date then id. */
export function scoredReplayChain<
  T extends { id: number; date: Date | string; status: string | null },
>(matches: T[], origin: T): T[] {
  const originTime = new Date(origin.date).getTime();
  return matches
    .filter((match) => {
      if (match.status !== "scored" && match.status !== "closed") {
        return false;
      }
      const time = new Date(match.date).getTime();
      if (time !== originTime) {
        return time > originTime;
      }
      return match.id >= origin.id;
    })
    .sort(compareByDateThenId);
}

/** Latest completed, scored, or closed match by date then id. Later open/started matches do not count. */
export function isLatestFinishedMatch<
  T extends { id: number; date: Date | string; status: string | null },
>(matches: T[], origin: T): boolean {
  const finished = matches.filter((match) => isFinishedStatus(match.status)).sort(compareByDateThenId);
  return finished.at(-1)?.id === origin.id;
}

export function canReopenMatchStats<
  T extends { id: number; date: Date | string; status: string | null },
>(matches: T[], origin: T): boolean {
  const status = normalizeMatchStatus(origin.status);
  if (status !== "scored" && status !== "closed") {
    return false;
  }
  return isLatestFinishedMatch(matches, origin);
}

export function isOfficialMatch(match: { isFriendly?: boolean | null }): boolean {
  return match.isFriendly !== true;
}
