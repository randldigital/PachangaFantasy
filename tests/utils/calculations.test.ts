import { describe, it, expect } from 'vitest';

// Market Value Calculation Tests
describe('Market Value Calculation', () => {
  // Mock function that simulates the market value calculation logic
  const calculateMarketValue = (rankings: number[]): number => {
    if (rankings.length === 0) return 50; // Default value
    
    let workingRankings = [...rankings];
    
    // Remove outliers if we have more than 2 rankings
    if (workingRankings.length > 2) {
      workingRankings.sort((a, b) => a - b);
      workingRankings = workingRankings.slice(1, -1); // Remove first and last
    }
    
    // Calculate average position
    const avgPosition = workingRankings.reduce((sum, pos) => sum + pos, 0) / workingRankings.length;
    
    // Convert position to market value (lower position = higher value)
    const maxValue = 120;
    const minValue = 10;
    const totalPlayers = 20; // Assume 20 players in league
    
    const normalizedPosition = (avgPosition - 1) / (totalPlayers - 1); // 0 to 1
    const marketValue = maxValue - (normalizedPosition * (maxValue - minValue));
    
    return Math.round(marketValue);
  };

  it('should calculate correct market value with multiple rankings', () => {
    const rankings = [1, 2, 1, 3, 2]; // Player ranked 1st, 2nd, 1st, 3rd, 2nd
    const marketValue = calculateMarketValue(rankings);
    
    // Should remove outliers (3) and calculate average of [1, 2, 1, 2] = 1.5
    expect(marketValue).toBeGreaterThan(100); // High market value for top-ranked player
  });

  it('should handle outlier removal correctly', () => {
    const rankings = [1, 5, 2, 3, 20]; // One very high outlier (20)
    const marketValue = calculateMarketValue(rankings);
    
    // Should remove 1 and 20, calculate average of [2, 3, 5] = 3.33
    // Let's verify the logic matches by checking the actual calculation
    expect(marketValue).toBeGreaterThan(100); // Should be high value since avg position is good
    expect(marketValue).toBeLessThan(115); // But not maximum since it's not position 1
  });

  it('should not remove outliers with 2 or fewer rankings', () => {
    const rankings = [1, 10]; // Should keep both
    const marketValue = calculateMarketValue(rankings);
    
    // Average should be 5.5
    expect(marketValue).toBeGreaterThan(80);
  });

  it('should handle single ranking', () => {
    const rankings = [1]; // Single top ranking
    const marketValue = calculateMarketValue(rankings);
    
    expect(marketValue).toBe(120); // Maximum value for rank 1
  });

  it('should return default value for empty rankings', () => {
    const rankings: number[] = [];
    const marketValue = calculateMarketValue(rankings);
    
    expect(marketValue).toBe(50);
  });
});

// Team Balancing Algorithm Tests
describe('Team Balancing Algorithm', () => {
  interface Player {
    id: number;
    marketValue: number;
  }

  const balanceTeams = (players: Player[]): { teamA: Player[], teamB: Player[] } => {
    if (players.length < 2) {
      return { teamA: players, teamB: [] };
    }

    // Sort players by market value (descending)
    const sortedPlayers = [...players].sort((a, b) => b.marketValue - a.marketValue);
    
    const teamA: Player[] = [];
    const teamB: Player[] = [];
    
    // Use greedy algorithm to balance teams
    for (const player of sortedPlayers) {
      const teamAValue = teamA.reduce((sum, p) => sum + p.marketValue, 0);
      const teamBValue = teamB.reduce((sum, p) => sum + p.marketValue, 0);
      
      if (teamAValue <= teamBValue) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    }
    
    return { teamA, teamB };
  };

  const calculateTeamValue = (team: Player[]): number => {
    return team.reduce((sum, player) => sum + player.marketValue, 0);
  };

  it('should create balanced teams with even number of players', () => {
    const players: Player[] = [
      { id: 1, marketValue: 100 },
      { id: 2, marketValue: 80 },
      { id: 3, marketValue: 70 },
      { id: 4, marketValue: 60 },
      { id: 5, marketValue: 50 },
      { id: 6, marketValue: 40 }
    ];

    const { teamA, teamB } = balanceTeams(players);
    
    expect(teamA.length).toBe(3);
    expect(teamB.length).toBe(3);
    
    const teamAValue = calculateTeamValue(teamA);
    const teamBValue = calculateTeamValue(teamB);
    const difference = Math.abs(teamAValue - teamBValue);
    
    // Teams should be reasonably balanced (within 30% of total value)
    const totalValue = teamAValue + teamBValue;
    expect(difference / totalValue).toBeLessThan(0.3);
  });

  it('should handle odd number of players', () => {
    const players: Player[] = [
      { id: 1, marketValue: 100 },
      { id: 2, marketValue: 80 },
      { id: 3, marketValue: 60 },
      { id: 4, marketValue: 40 },
      { id: 5, marketValue: 20 }
    ];

    const { teamA, teamB } = balanceTeams(players);
    
    expect(teamA.length + teamB.length).toBe(5);
    expect(Math.abs(teamA.length - teamB.length)).toBeLessThanOrEqual(1);
  });

  it('should put highest value player on team with lower total value', () => {
    const players: Player[] = [
      { id: 1, marketValue: 100 },
      { id: 2, marketValue: 50 },
      { id: 3, marketValue: 50 }
    ];

    const { teamA, teamB } = balanceTeams(players);
    
    // The 100-value player should be balanced against the two 50-value players
    const teamAValue = calculateTeamValue(teamA);
    const teamBValue = calculateTeamValue(teamB);
    
    expect(Math.abs(teamAValue - teamBValue)).toBeLessThanOrEqual(50);
  });
});

// Lineup Cost Validation Tests
describe('Lineup Cost Validation', () => {
  interface Player {
    id: number;
    marketValue: number;
  }

  const validateLineupCost = (playerIds: number[], players: Player[], budget: number): { isValid: boolean, totalCost: number, message?: string } => {
    if (playerIds.length !== 5) {
      return { isValid: false, totalCost: 0, message: 'Lineup must contain exactly 5 players' };
    }

    const selectedPlayers = players.filter(p => playerIds.includes(p.id));
    
    if (selectedPlayers.length !== 5) {
      return { isValid: false, totalCost: 0, message: 'Some players not found' };
    }

    const totalCost = selectedPlayers.reduce((sum, p) => sum + p.marketValue, 0);
    
    if (totalCost > budget) {
      return { isValid: false, totalCost, message: `Total cost ${totalCost} exceeds budget ${budget}` };
    }

    return { isValid: true, totalCost };
  };

  const mockPlayers: Player[] = [
    { id: 1, marketValue: 30 },
    { id: 2, marketValue: 25 },
    { id: 3, marketValue: 20 },
    { id: 4, marketValue: 15 },
    { id: 5, marketValue: 10 },
    { id: 6, marketValue: 25 },
    { id: 7, marketValue: 20 }
  ];

  it('should validate lineup within budget', () => {
    const playerIds = [1, 2, 3, 4, 5]; // 30+25+20+15+10 = 100
    const budget = 100;
    
    const result = validateLineupCost(playerIds, mockPlayers, budget);
    
    expect(result.isValid).toBe(true);
    expect(result.totalCost).toBe(100);
  });

  it('should reject lineup exceeding budget', () => {
    const playerIds = [1, 2, 6, 3, 7]; // 30+25+25+20+20 = 120
    const budget = 100;
    
    const result = validateLineupCost(playerIds, mockPlayers, budget);
    
    expect(result.isValid).toBe(false);
    expect(result.totalCost).toBe(120);
    expect(result.message).toContain('exceeds budget');
  });

  it('should require exactly 5 players', () => {
    const playerIds = [1, 2, 3]; // Only 3 players
    const budget = 100;
    
    const result = validateLineupCost(playerIds, mockPlayers, budget);
    
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('exactly 5 players');
  });

  it('should handle non-existent players', () => {
    const playerIds = [1, 2, 3, 4, 999]; // Player 999 doesn't exist
    const budget = 100;
    
    const result = validateLineupCost(playerIds, mockPlayers, budget);
    
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('not found');
  });
});

// Points Calculation Tests
describe('Points Calculation', () => {
  interface StatReport {
    goals: number;
    assists: number;
    userId: number;
  }

  const calculatePoints = (statReport: StatReport, isWinner: boolean = false): number => {
    const goalPoints = statReport.goals * 3;
    const assistPoints = statReport.assists * 2;
    const winBonus = isWinner ? 1 : 0;
    
    return goalPoints + assistPoints + winBonus;
  };

  it('should calculate points correctly for goals and assists', () => {
    const statReport: StatReport = {
      goals: 2,
      assists: 3,
      userId: 1
    };
    
    const points = calculatePoints(statReport);
    
    expect(points).toBe(12); // (2*3) + (3*2) = 6 + 6 = 12
  });

  it('should add win bonus correctly', () => {
    const statReport: StatReport = {
      goals: 1,
      assists: 1,
      userId: 1
    };
    
    const pointsWithWin = calculatePoints(statReport, true);
    const pointsWithoutWin = calculatePoints(statReport, false);
    
    expect(pointsWithWin).toBe(6); // (1*3) + (1*2) + 1 = 6
    expect(pointsWithoutWin).toBe(5); // (1*3) + (1*2) = 5
  });

  it('should handle zero stats', () => {
    const statReport: StatReport = {
      goals: 0,
      assists: 0,
      userId: 1
    };
    
    const pointsWithWin = calculatePoints(statReport, true);
    const pointsWithoutWin = calculatePoints(statReport, false);
    
    expect(pointsWithWin).toBe(1); // Only win bonus
    expect(pointsWithoutWin).toBe(0); // No points
  });

  it('should handle high numbers correctly', () => {
    const statReport: StatReport = {
      goals: 5,
      assists: 4,
      userId: 1
    };
    
    const points = calculatePoints(statReport, true);
    
    expect(points).toBe(24); // (5*3) + (4*2) + 1 = 15 + 8 + 1 = 24
  });
});