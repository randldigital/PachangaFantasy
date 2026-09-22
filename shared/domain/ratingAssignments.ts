/** Fantasy ballots split by side; Club ballots draw from one pool. */
export type RatingKind = "teammate" | "rival" | "club";

export type RatingAssignment = {
  raterPlayerId: number;
  rateePlayerId: number;
  kind: RatingKind;
};

export type RatingAssignmentInput = {
  matchId: number;
  teamA: number[];
  teamB: number[];
  voterPlayerIds: number[];
  participantIds: number[];
};

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

function teamOf(playerId: number, teamA: number[], teamB: number[]): "A" | "B" | null {
  if (teamA.includes(playerId)) {
    return "A";
  }
  if (teamB.includes(playerId)) {
    return "B";
  }
  return null;
}

function teammates(playerId: number, teamA: number[], teamB: number[]): number[] {
  const team = teamOf(playerId, teamA, teamB);
  const pool = team === "A" ? teamA : team === "B" ? teamB : [];
  return pool.filter((id) => id !== playerId);
}

function rivals(playerId: number, teamA: number[], teamB: number[]): number[] {
  const team = teamOf(playerId, teamA, teamB);
  if (team === "A") {
    return [...teamB];
  }
  if (team === "B") {
    return [...teamA];
  }
  return [];
}

function incomingCount(assignments: RatingAssignment[], playerId: number): number {
  return assignments.filter((row) => row.rateePlayerId === playerId).length;
}

function outgoingCount(assignments: RatingAssignment[], playerId: number): number {
  return assignments.filter((row) => row.raterPlayerId === playerId).length;
}

function hasPair(
  assignments: RatingAssignment[],
  raterPlayerId: number,
  rateePlayerId: number,
): boolean {
  return assignments.some(
    (row) => row.raterPlayerId === raterPlayerId && row.rateePlayerId === rateePlayerId,
  );
}

function pickLeastRated(
  candidates: number[],
  assignments: RatingAssignment[],
  rng: () => number,
): number | undefined {
  if (candidates.length === 0) {
    return undefined;
  }
  const ranked = shuffled(candidates, rng).sort(
    (left, right) => incomingCount(assignments, left) - incomingCount(assignments, right),
  );
  return ranked[0];
}

function addAssignment(
  assignments: RatingAssignment[],
  raterPlayerId: number,
  rateePlayerId: number,
  kind: RatingKind,
): boolean {
  if (raterPlayerId === rateePlayerId) {
    return false;
  }
  if (hasPair(assignments, raterPlayerId, rateePlayerId)) {
    return false;
  }
  assignments.push({ raterPlayerId, rateePlayerId, kind });
  return true;
}

export const TARGET_OUTGOING_TEAMMATES = 2;
export const TARGET_OUTGOING_RIVALS = 2;
export const TARGET_INCOMING = 4;

function assignFromPool(
  assignments: RatingAssignment[],
  voter: number,
  pool: number[],
  kind: RatingKind,
  count: number,
  rng: () => number,
) {
  let remaining = count;
  while (remaining > 0) {
    const available = pool.filter((id) => !hasPair(assignments, voter, id));
    if (available.length === 0) {
      break;
    }
    const pick = pickLeastRated(available, assignments, rng);
    if (pick == null) {
      break;
    }
    if (addAssignment(assignments, voter, pick, kind)) {
      remaining -= 1;
    } else {
      break;
    }
  }
}

export function assignMatchRatings(input: RatingAssignmentInput): RatingAssignment[] {
  const assignments: RatingAssignment[] = [];
  const rng = mulberry32(input.matchId * 10007 + input.voterPlayerIds.length * 13 + 7);
  const voters = shuffled(
    input.voterPlayerIds.filter((id) => input.participantIds.includes(id)),
    rng,
  );

  for (const voter of voters) {
    const mateOptions = teammates(voter, input.teamA, input.teamB);
    const rivalOptions = rivals(voter, input.teamA, input.teamB);

    assignFromPool(assignments, voter, mateOptions, "teammate", TARGET_OUTGOING_TEAMMATES, rng);
    assignFromPool(assignments, voter, rivalOptions, "rival", TARGET_OUTGOING_RIVALS, rng);

    // Lone player on a side: fill remaining outgoing slots with rivals.
    const outgoing = outgoingCount(assignments, voter);
    const need = TARGET_OUTGOING_TEAMMATES + TARGET_OUTGOING_RIVALS - outgoing;
    if (need > 0 && rivalOptions.length > 0) {
      assignFromPool(assignments, voter, rivalOptions, "rival", need, rng);
    }
  }

  let guard = 0;
  while (guard < 400) {
    guard += 1;
    const under = input.participantIds.filter(
      (id) => incomingCount(assignments, id) < TARGET_INCOMING,
    );
    if (under.length === 0 || voters.length === 0) {
      break;
    }

    let progressed = false;
    for (const ratee of shuffled(under, rng).sort(
      (left, right) => incomingCount(assignments, left) - incomingCount(assignments, right),
    )) {
      const legal = voters
        .filter((voter) => voter !== ratee && !hasPair(assignments, voter, ratee))
        .sort(
          (left, right) => outgoingCount(assignments, left) - outgoingCount(assignments, right),
        );
      if (legal.length === 0) {
        continue;
      }
      const rater = legal[0];
      const sameTeam = teamOf(rater, input.teamA, input.teamB) === teamOf(ratee, input.teamA, input.teamB);
      if (addAssignment(assignments, rater, ratee, sameTeam ? "teammate" : "rival")) {
        progressed = true;
        break;
      }
    }
    if (!progressed) {
      break;
    }
  }

  return assignments;
}

export function ratingsAreComplete(
  voterPlayerIds: number[],
  submittedVoterIds: number[],
): boolean {
  if (voterPlayerIds.length === 0) {
    return true;
  }
  const submitted = new Set(submittedVoterIds);
  return voterPlayerIds.every((id) => submitted.has(id));
}

export function ballotMatchesAssignments(
  raterPlayerId: number,
  ratings: { playerId: number }[],
  assignments: RatingAssignment[],
): boolean {
  const expected = assignments
    .filter((row) => row.raterPlayerId === raterPlayerId)
    .map((row) => row.rateePlayerId)
    .sort((left, right) => left - right);
  const received = ratings.map((row) => row.playerId).sort((left, right) => left - right);
  if (expected.length !== received.length) {
    return false;
  }
  return expected.every((id, index) => id === received[index]);
}
