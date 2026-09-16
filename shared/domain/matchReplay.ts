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
    .sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate !== 0) {
        return byDate;
      }
      return a.id - b.id;
    });
}

export function isOfficialMatch(match: { isFriendly?: boolean | null }): boolean {
  return match.isFriendly !== true;
}
