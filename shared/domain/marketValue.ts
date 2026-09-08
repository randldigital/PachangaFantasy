export const DEFAULT_SCORING_BASELINE = 5;
export const MIN_MARKET_VALUE = 8;
export const MAX_DYNAMIC_MARKET_VALUE = 28;
export const ASSIST_WEIGHT = 0.8;
export const EXPECTED_AT_MAX_VM = 0.33;
export const VM_SPAN = 20;
export const PERFORMANCE_NEUTRAL = 0.5;
export const RAW_CHANGE_SCALE = 20;
export const MIN_VM_DELTA = -3;
export const MAX_VM_DELTA = 5;
export const MVP_WEIGHT = 0.4;
export const PEER_WEIGHT = 0.25;
export const OFFENSIVE_WEIGHT = 0.25;
export const RESULT_WEIGHT = 0.1;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function vmPositionX(vm: number): number {
  return clamp((vm - MIN_MARKET_VALUE) / VM_SPAN, 0, 1);
}

export function expectedContribution(vm: number): number {
  return EXPECTED_AT_MAX_VM * vmPositionX(vm);
}

export function nextScoringBaseline(
  previous: number,
  teamAGoals: number,
  teamBGoals: number,
): number {
  const averageGoalsPerTeam = (teamAGoals + teamBGoals) / 2;
  return 0.8 * previous + 0.2 * averageGoalsPerTeam;
}

export function opponentDifficulty(ownAvgVm: number, oppAvgVm: number): number {
  if (ownAvgVm <= 0) {
    return 1;
  }
  return clamp(oppAvgVm / ownAvgVm, 0.9, 1.1);
}

export function weightedOffense(goals: number, assists: number): number {
  return goals + ASSIST_WEIGHT * assists;
}

export function averageVm(playerIds: number[], preMatchVm: Record<number, number>): number {
  if (playerIds.length === 0) {
    return MIN_MARKET_VALUE;
  }
  const total = playerIds.reduce(
    (sum, id) => sum + (preMatchVm[id] ?? MIN_MARKET_VALUE),
    0,
  );
  return total / playerIds.length;
}

export function offensiveAdjusted(input: {
  weighted: number;
  teamWeighted: number;
  teamGoals: number;
  baseline: number;
  ownAvgVm: number;
  oppAvgVm: number;
}): number {
  const share = input.teamWeighted <= 0 ? 0 : input.weighted / input.teamWeighted;
  const contribution = input.baseline <= 0 ? 0 : share * (input.teamGoals / input.baseline);
  return contribution * opponentDifficulty(input.ownAvgVm, input.oppAvgVm);
}

export function offensiveComponent(adjusted: number, expected: number): number {
  if (expected === 0) {
    if (adjusted === 0) {
      return PERFORMANCE_NEUTRAL;
    }
    return clamp(PERFORMANCE_NEUTRAL + adjusted / EXPECTED_AT_MAX_VM, 0, 1);
  }
  return clamp((PERFORMANCE_NEUTRAL * adjusted) / expected, 0, 1);
}

export function mapPeerRating(score: number): number {
  return clamp((score - 1) / 4, 0, 1);
}

export function peerComponent(scores: number[]): number {
  if (scores.length === 0) {
    return PERFORMANCE_NEUTRAL;
  }
  const total = scores.reduce((sum, score) => sum + mapPeerRating(score), 0);
  return total / scores.length;
}

export function mvpComponents(
  participantIds: number[],
  votes: { voterPlayerId: number; mvpPlayerId: number }[],
): Map<number, number> {
  const scores = new Map<number, number>();
  for (const id of participantIds) {
    scores.set(id, PERFORMANCE_NEUTRAL);
  }
  if (votes.length === 0) {
    return scores;
  }

  const counts = new Map<number, number>();
  for (const vote of votes) {
    counts.set(vote.mvpPlayerId, (counts.get(vote.mvpPlayerId) ?? 0) + 1);
  }
  const maxVotes = Math.max(...counts.values());
  const total = votes.length;

  for (const id of participantIds) {
    const count = counts.get(id) ?? 0;
    if (count === 0) {
      scores.set(id, 0);
    } else if (count === maxVotes) {
      scores.set(id, 1);
    } else {
      scores.set(id, count / total);
    }
  }
  return scores;
}

export function resultComponent(
  ownGoals: number,
  oppGoals: number,
  ownAvgVm: number,
  oppAvgVm: number,
): number {
  const advantage = clamp((oppAvgVm - ownAvgVm) / VM_SPAN, -1, 1);
  if (ownGoals > oppGoals) {
    return 0.55 + (0.3 * (advantage + 1)) / 2;
  }
  if (ownGoals === oppGoals) {
    return 0.5 + 0.1 * advantage;
  }
  return 0.35 + 0.2 * advantage;
}

export function performanceScore(parts: {
  mvp: number;
  peer: number;
  offensive: number;
  result: number;
}): number {
  return (
    MVP_WEIGHT * parts.mvp +
    PEER_WEIGHT * parts.peer +
    OFFENSIVE_WEIGHT * parts.offensive +
    RESULT_WEIGHT * parts.result
  );
}

export type MarketValueChange = {
  vmBefore: number;
  vmAfter: number;
  delta: number;
  rawChange: number;
  multiplier: number;
  unclampedDelta: number;
};

export function applyMarketValueChange(currentVm: number, score: number): MarketValueChange {
  const rawChange = RAW_CHANGE_SCALE * (score - PERFORMANCE_NEUTRAL);
  const x = vmPositionX(currentVm);
  const multiplier =
    rawChange > 0 ? 1 - 0.65 * x : rawChange < 0 ? 0.35 + 0.65 * x : 1;
  const unclampedDelta = rawChange * multiplier;
  const clampedDelta = clamp(unclampedDelta, MIN_VM_DELTA, MAX_VM_DELTA);
  const vmAfter = clamp(
    Math.round(currentVm + clampedDelta),
    MIN_MARKET_VALUE,
    MAX_DYNAMIC_MARKET_VALUE,
  );
  return {
    vmBefore: currentVm,
    vmAfter,
    delta: vmAfter - Math.round(currentVm),
    rawChange,
    multiplier,
    unclampedDelta,
  };
}

export type MarketValuePlayerInput = {
  playerId: number;
  goals: number;
  assists: number;
};

export type MarketValueMatchInput = {
  participantIds: number[];
  teamA: number[];
  teamB: number[];
  teamAGoals: number;
  teamBGoals: number;
  baseline: number;
  preMatchVm: Record<number, number>;
  stats: MarketValuePlayerInput[];
  mvpVotes: { voterPlayerId: number; mvpPlayerId: number }[];
  peerRatings: { raterPlayerId: number; rateePlayerId: number; score: number }[];
};

export type MarketValuePlayerResult = {
  playerId: number;
  team: "A" | "B";
  mvp: number;
  peer: number;
  offensive: number;
  result: number;
  performanceScore: number;
  expectedContribution: number;
  adjustedContribution: number;
  mvpVotes: number;
  peerAverage: number | null;
  ownTeamAvgVm: number;
  oppTeamAvgVm: number;
  baseline: number;
  change: MarketValueChange;
};

export function teamOfPlayer(
  playerId: number,
  teamA: number[],
  teamB: number[],
): "A" | "B" | null {
  if (teamA.includes(playerId)) {
    return "A";
  }
  if (teamB.includes(playerId)) {
    return "B";
  }
  return null;
}

export function computeMatchMarketValues(input: MarketValueMatchInput): MarketValuePlayerResult[] {
  const statsByPlayer = new Map(input.stats.map((row) => [row.playerId, row]));
  const teamAAvg = averageVm(input.teamA, input.preMatchVm);
  const teamBAvg = averageVm(input.teamB, input.preMatchVm);
  const teamAWeighted = input.teamA.reduce((sum, id) => {
    const row = statsByPlayer.get(id);
    return sum + weightedOffense(row?.goals ?? 0, row?.assists ?? 0);
  }, 0);
  const teamBWeighted = input.teamB.reduce((sum, id) => {
    const row = statsByPlayer.get(id);
    return sum + weightedOffense(row?.goals ?? 0, row?.assists ?? 0);
  }, 0);

  const mvp = mvpComponents(input.participantIds, input.mvpVotes);
  const voteCounts = new Map<number, number>();
  for (const vote of input.mvpVotes) {
    voteCounts.set(vote.mvpPlayerId, (voteCounts.get(vote.mvpPlayerId) ?? 0) + 1);
  }

  return input.participantIds.map((playerId) => {
    const team = teamOfPlayer(playerId, input.teamA, input.teamB) ?? "A";
    const ownGoals = team === "A" ? input.teamAGoals : input.teamBGoals;
    const oppGoals = team === "A" ? input.teamBGoals : input.teamAGoals;
    const ownAvg = team === "A" ? teamAAvg : teamBAvg;
    const oppAvg = team === "A" ? teamBAvg : teamAAvg;
    const teamWeighted = team === "A" ? teamAWeighted : teamBWeighted;
    const row = statsByPlayer.get(playerId);
    const vm = input.preMatchVm[playerId] ?? MIN_MARKET_VALUE;
    const expected = expectedContribution(vm);
    const adjusted = offensiveAdjusted({
      weighted: weightedOffense(row?.goals ?? 0, row?.assists ?? 0),
      teamWeighted,
      teamGoals: ownGoals,
      baseline: input.baseline,
      ownAvgVm: ownAvg,
      oppAvgVm: oppAvg,
    });
    const received = input.peerRatings
      .filter((rating) => rating.rateePlayerId === playerId)
      .map((rating) => rating.score);
    const parts = {
      mvp: mvp.get(playerId) ?? 0,
      peer: peerComponent(received),
      offensive: offensiveComponent(adjusted, expected),
      result: resultComponent(ownGoals, oppGoals, ownAvg, oppAvg),
    };
    const score = performanceScore(parts);
    const change = applyMarketValueChange(vm, score);
    const peerAverage =
      received.length === 0
        ? null
        : received.reduce((sum, value) => sum + value, 0) / received.length;

    return {
      playerId,
      team,
      ...parts,
      performanceScore: score,
      expectedContribution: expected,
      adjustedContribution: adjusted,
      mvpVotes: voteCounts.get(playerId) ?? 0,
      peerAverage,
      ownTeamAvgVm: ownAvg,
      oppTeamAvgVm: oppAvg,
      baseline: input.baseline,
      change,
    };
  });
}
