import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseStorage } from '../../server/storage';
import { db } from '../../server/db';
import { users, leagues, players, matches, matchParticipants } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Match System (Player-Based)', () => {
  let storage: DatabaseStorage;
  let user: any;
  let league: any;
  let player: any;
  let match: any;

  beforeEach(async () => {
    storage = new DatabaseStorage();
    
    // Clear existing data
    await db.delete(matchParticipants);
    await db.delete(matches);
    await db.delete(players);
    await db.delete(leagues);
    await db.delete(users);

    // Create test user
    user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });

    // Create test league
    league = await storage.createLeague({
      name: 'Test League',
      description: 'Test description'
    }, user.id);

    // Create test player linked to user
    player = await storage.createPlayer({
      name: 'Test Player',
      emoji: '⚽',
      leagueId: league.id,
      userId: user.id
    });

    // Create test match
    match = await storage.createMatch({
      leagueId: league.id,
      date: new Date('2025-07-10'),
      lineupBudget: 100
    }, user.id);
  });

  describe('Match Creation', () => {
    it('should create a match', async () => {
      expect(match).toBeDefined();
      expect(match.leagueId).toBe(league.id);
      expect(match.status).toBe('open');
      expect(match.lineupBudget).toBe(100);
    });

    it('should get match by ID', async () => {
      const foundMatch = await storage.getMatch(match.id);
      expect(foundMatch).toBeDefined();
      expect(foundMatch!.id).toBe(match.id);
      expect(foundMatch!.leagueId).toBe(league.id);
    });

    it('should get matches by league', async () => {
      const matches = await storage.getMatchesByLeague(league.id);
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe(match.id);
    });
  });

  describe('Match Participants (Player-Based)', () => {
    it('should allow user to join match through their player record', async () => {
      const participant = await storage.joinMatch(match.id, user.id);
      expect(participant.matchId).toBe(match.id);
      expect(participant.playerId).toBe(player.id);
      expect(participant.status).toBe('accepted');
    });

    it('should prevent duplicate participants', async () => {
      await storage.joinMatch(match.id, user.id);
      const participant2 = await storage.joinMatch(match.id, user.id);
      expect(participant2.playerId).toBe(player.id);
      expect(participant2.matchId).toBe(match.id);
    });

    it('should add player to match directly by player ID', async () => {
      const participant = await storage.addPlayerToMatch(match.id, player.id);
      expect(participant.matchId).toBe(match.id);
      expect(participant.playerId).toBe(player.id);
      expect(participant.status).toBe('accepted');
    });

    it('should get all match participants', async () => {
      await storage.joinMatch(match.id, user.id);
      
      const participants = await storage.getMatchParticipants(match.id);
      expect(participants).toHaveLength(1);
      expect(participants[0].playerId).toBe(player.id);
    });

    it('should handle players without user accounts', async () => {
      // Create a player without userId (like a friend added to league)
      const nonUserPlayer = await storage.createPlayer({
        name: 'Non-User Player',
        emoji: '🏃',
        leagueId: league.id
      });

      const participant = await storage.addPlayerToMatch(match.id, nonUserPlayer.id);
      expect(participant.matchId).toBe(match.id);
      expect(participant.playerId).toBe(nonUserPlayer.id);
      expect(participant.status).toBe('accepted');
    });
  });

  describe('Team Balancing', () => {
    it('should balance teams', async () => {
      // Create additional players for testing
      const player2 = await storage.createPlayer({
        name: 'Player 2',
        emoji: '🏃',
        leagueId: league.id
      });
      
      const player3 = await storage.createPlayer({
        name: 'Player 3',
        emoji: '🏃',
        leagueId: league.id
      });

      const player4 = await storage.createPlayer({
        name: 'Player 4',
        emoji: '🏃',
        leagueId: league.id
      });

      const playerIds = [player.id, player2.id, player3.id, player4.id];
      const teams = await storage.balanceTeams(match.id, playerIds);

      expect(teams.teamA).toHaveLength(2);
      expect(teams.teamB).toHaveLength(2);
      expect([...teams.teamA, ...teams.teamB]).toEqual(expect.arrayContaining(playerIds));
    });
  });

  describe('Lineup System', () => {
    it('should create and get lineup', async () => {
      // Add user as participant first
      await storage.joinMatch(match.id, user.id);

      const lineup = await storage.createLineup({
        matchId: match.id,
        userId: user.id,
        playerIds: [player.id],
        captainId: player.id,
        totalCost: 50
      });

      expect(lineup).toBeDefined();
      expect(lineup.matchId).toBe(match.id);
      expect(lineup.userId).toBe(user.id);
      expect(lineup.playerIds).toEqual([player.id]);
      expect(lineup.captainId).toBe(player.id);
      expect(lineup.totalCost).toBe(50);

      const foundLineup = await storage.getLineup(match.id, user.id);
      expect(foundLineup).toBeDefined();
      expect(foundLineup!.id).toBe(lineup.id);
    });
  });

  describe('Stats and Scoring', () => {
    it('should create and verify stat reports', async () => {
      const statReport = await storage.createStatReport({
        userId: user.id,
        matchId: match.id,
        goals: 2,
        assists: 1
      });

      expect(statReport).toBeDefined();
      expect(statReport.goals).toBe(2);
      expect(statReport.assists).toBe(1);
      expect(statReport.verifiedStatus).toBe('pending');

      const verified = await storage.verifyStatReport(statReport.id, user.id, 'confirmed');
      expect(verified).toBeDefined();
      expect(verified!.verifiedStatus).toBe('confirmed');
    });

    it('should calculate match scores', async () => {
      // Add user as participant
      await storage.joinMatch(match.id, user.id);

      // Create lineup
      await storage.createLineup({
        matchId: match.id,
        userId: user.id,
        playerIds: [player.id],
        captainId: player.id,
        totalCost: 50
      });

      // Create and verify stat report
      const statReport = await storage.createStatReport({
        userId: user.id,
        matchId: match.id,
        goals: 2,
        assists: 1
      });

      await storage.verifyStatReport(statReport.id, user.id, 'confirmed');

      // Calculate scores
      const scores = await storage.calculateMatchScores(match.id);
      expect(scores).toHaveLength(1);
      expect(scores[0].userId).toBe(user.id);
      expect(scores[0].points).toBeGreaterThan(0);
    });
  });

  describe('League Rankings', () => {
    it('should get league rankings', async () => {
      // Add user as participant and create score
      await storage.joinMatch(match.id, user.id);
      await storage.createLineup({
        matchId: match.id,
        userId: user.id,
        playerIds: [player.id],
        captainId: player.id,
        totalCost: 50
      });

      const statReport = await storage.createStatReport({
        userId: user.id,
        matchId: match.id,
        goals: 2,
        assists: 1
      });

      await storage.verifyStatReport(statReport.id, user.id, 'confirmed');
      await storage.calculateMatchScores(match.id);

      const rankings = await storage.getLeagueRankings(league.id);
      expect(rankings).toHaveLength(1);
      expect(rankings[0].userId).toBe(user.id);
      expect(rankings[0].totalPoints).toBeGreaterThan(0);
    });
  });
});