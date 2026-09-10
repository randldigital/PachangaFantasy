/**
 * A Player and a Match each belong to exactly one context: a Fantasy League or a Club.
 * The two identifiers are mutually exclusive, so the context is read from whichever is set.
 */
export type MatchContext = "league" | "club";

export interface ContextRef {
  leagueId?: number | null;
  clubId?: number | null;
}

/** True when exactly one of the two identifiers is present. */
export function hasSingleContext(ref: ContextRef): boolean {
  return (ref.leagueId != null) !== (ref.clubId != null);
}

export function contextOf(ref: ContextRef): MatchContext {
  if (!hasSingleContext(ref)) {
    throw new Error("A player or match must belong to exactly one league or club");
  }
  return ref.leagueId != null ? "league" : "club";
}

export function isClubContext(ref: ContextRef): boolean {
  return ref.clubId != null;
}

export function isLeagueContext(ref: ContextRef): boolean {
  return ref.leagueId != null;
}

/** The League a Fantasy-only path operates on. Throws if the row is a Club row. */
export function requireLeagueId(ref: ContextRef): number {
  if (ref.leagueId == null) {
    throw new Error("This operation is only available on Fantasy League matches");
  }
  return ref.leagueId;
}

/** The Club a Club-only path operates on. Throws if the row is a League row. */
export function requireClubId(ref: ContextRef): number {
  if (ref.clubId == null) {
    throw new Error("This operation is only available on Club matches");
  }
  return ref.clubId;
}

/** The owning identifier, whichever context the row belongs to. */
export function contextIdOf(ref: ContextRef): number {
  const id = ref.leagueId ?? ref.clubId;
  if (id == null) {
    throw new Error("A player or match must belong to exactly one league or club");
  }
  return id;
}
