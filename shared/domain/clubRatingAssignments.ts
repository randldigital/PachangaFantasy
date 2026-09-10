/**
 * Club peer-rating assignments. There are no sides in Club Mode, so every participant
 * (registered or external) is rated from one pool. Only registered participants vote.
 */

import type { RatingAssignment } from "./ratingAssignments";

/** Every participant should receive at least this many incoming ratings when possible. */
export const CLUB_TARGET_INCOMING = 3;

/** Below this many voters, everyone simply rates everyone else. */
export const CLUB_MIN_VOTERS_FOR_TARGET = 4;

export interface ClubAssignmentInput {
  matchId: number;
  participantIds: number[];
  voterPlayerIds: number[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

/**
 * Simple random fill rather than an optimiser: walk the participants who are short of
 * incoming ratings and hand each one to the least-loaded eligible voter. Outgoing counts
 * are allowed to differ, so a voter may end up rating four people while another rates three.
 */
export function assignClubRatings(input: ClubAssignmentInput): RatingAssignment[] {
  const participants = [...new Set(input.participantIds)];
  const voters = [...new Set(input.voterPlayerIds)].filter((id) => participants.includes(id));
  const assignments: RatingAssignment[] = [];

  if (voters.length === 0 || participants.length < 2) {
    return assignments;
  }

  const rng = mulberry32(input.matchId * 7919 + participants.length * 31 + voters.length);
  const incoming = new Map<number, number>(participants.map((id) => [id, 0]));
  const outgoing = new Map<number, number>(voters.map((id) => [id, 0]));
  const pairs = new Set<string>();

  const add = (rater: number, ratee: number) => {
    if (rater === ratee || pairs.has(`${rater}:${ratee}`)) {
      return false;
    }
    pairs.add(`${rater}:${ratee}`);
    assignments.push({ raterPlayerId: rater, rateePlayerId: ratee, kind: "club" });
    incoming.set(ratee, (incoming.get(ratee) ?? 0) + 1);
    outgoing.set(rater, (outgoing.get(rater) ?? 0) + 1);
    return true;
  };

  // Small squad: full coverage beats an unreachable target of three.
  if (voters.length < CLUB_MIN_VOTERS_FOR_TARGET) {
    for (const voter of voters) {
      for (const ratee of participants) {
        add(voter, ratee);
      }
    }
    return assignments;
  }

  const target = Math.min(CLUB_TARGET_INCOMING, voters.length - 1);
  for (const ratee of shuffled(participants, rng)) {
    while ((incoming.get(ratee) ?? 0) < target) {
      const eligible = shuffled(
        voters.filter((voter) => voter !== ratee && !pairs.has(`${voter}:${ratee}`)),
        rng,
      ).sort((left, right) => (outgoing.get(left) ?? 0) - (outgoing.get(right) ?? 0));
      if (eligible.length === 0 || !add(eligible[0], ratee)) {
        break;
      }
    }
  }

  return assignments;
}

/** Incoming ballots per participant, used to check the ≥3 coverage goal. */
export function incomingCounts(assignments: RatingAssignment[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of assignments) {
    counts.set(row.rateePlayerId, (counts.get(row.rateePlayerId) ?? 0) + 1);
  }
  return counts;
}
