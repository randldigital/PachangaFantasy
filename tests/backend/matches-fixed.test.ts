import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '@server/routes';
import { DatabaseStorage } from '@server/storage';

// Mock the storage
vi.mock('@server/storage', () => {
  const mockStorage = {
    getUser: vi.fn(),
    getLeague: vi.fn(),
    createMatch: vi.fn(),
    getMatch: vi.fn(),
    getMatchesByLeague: vi.fn(),
    joinMatch: vi.fn(),
    getMatchParticipants: vi.fn(),
    addPlayerToMatch: vi.fn(),
    checkUserAsPlayer: vi.fn(),
    createLineup: vi.fn(),
    getLineup: vi.fn(),
    updateLineup: vi.fn(),
    createStatReport: vi.fn(),
    calculateMatchScores: vi.fn(),
    getLeagueRankings: vi.fn(),
  };
  
  return {
    DatabaseStorage: vi.fn(() => mockStorage),
    storage: mockStorage,
  };
});

describe('Match System Routes', () => {
  let app: express.Application;
  let mockStorage: any;
  let authToken: string;
  let testUser: any;
  let testLeague: any;
  let testMatch: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    mockStorage = new DatabaseStorage();
    await registerRoutes(app);

    testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'player'
    };

    testLeague = {
      id: 1,
      name: 'Test League',
      createdBy: testUser.id,
      inviteCode: 'ABC123',
      status: 'open'
    };

    testMatch = {
      id: 1,
      leagueId: testLeague.id,
      date: new Date('2025-07-15T19:00:00Z'),
      status: 'open',
      lineupBudget: 100,
      createdBy: testUser.id
    };

    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    
    mockStorage.getUser.mockResolvedValue(testUser);
    mockStorage.getLeague.mockResolvedValue(testLeague);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Match Creation', () => {
    it('should create match as league creator', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: new Date('2025-07-15T19:00:00Z'),
        lineupBudget: 100
      };

      mockStorage.createMatch.mockResolvedValue(testMatch);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(200);
      expect(response.body.leagueId).toBe(testLeague.id);
      expect(response.body.status).toBe('open');
      expect(response.body.createdBy).toBe(testUser.id);
    });

    it('should prevent non-creator from creating matches', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: new Date('2025-07-15T19:00:00Z'),
        lineupBudget: 100
      };

      // Mock league with different creator
      const differentLeague = { ...testLeague, createdBy: 999 };
      mockStorage.getLeague.mockResolvedValue(differentLeague);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should get match by ID', async () => {
      mockStorage.getMatch.mockResolvedValue(testMatch);

      const response = await request(app)
        .get('/api/matches/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.leagueId).toBe(testLeague.id);
    });

    it('should get matches by league', async () => {
      const matches = [testMatch];
      mockStorage.getMatchesByLeague.mockResolvedValue(matches);

      const response = await request(app)
        .get(`/api/leagues/${testLeague.id}/matches`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('Match Participation', () => {
    it('should allow user to join match', async () => {
      const userPlayer = {
        id: 1,
        name: testUser.username,
        userId: testUser.id,
        leagueId: testLeague.id
      };

      const participant = {
        id: 1,
        matchId: testMatch.id,
        playerId: userPlayer.id,
        status: 'accepted'
      };

      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.checkUserAsPlayer.mockResolvedValue(userPlayer);
      mockStorage.joinMatch.mockResolvedValue(participant);

      const response = await request(app)
        .post('/api/matches/1/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.playerId).toBe(userPlayer.id);
      expect(response.body.status).toBe('accepted');
    });

    it('should prevent joining without player record', async () => {
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.checkUserAsPlayer.mockResolvedValue(undefined); // No player record

      const response = await request(app)
        .post('/api/matches/1/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('player record');
    });

    it('should get match participants', async () => {
      const participants = [
        {
          id: 1,
          matchId: testMatch.id,
          playerId: 1,
          status: 'accepted',
          player: { id: 1, name: 'Player 1', emoji: '⚽' }
        }
      ];

      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.getMatchParticipants.mockResolvedValue(participants);

      const response = await request(app)
        .get('/api/matches/1/participants')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('Lineup System', () => {
    it('should create lineup for match participant', async () => {
      const lineupData = {
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        totalCost: 75
      };

      const lineup = {
        id: 1,
        matchId: testMatch.id,
        userId: testUser.id,
        ...lineupData
      };

      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.createLineup.mockResolvedValue(lineup);

      const response = await request(app)
        .post('/api/matches/1/lineup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);

      expect(response.status).toBe(200);
      expect(response.body.playerIds).toEqual(lineupData.playerIds);
      expect(response.body.captainId).toBe(lineupData.captainId);
      expect(response.body.totalCost).toBe(lineupData.totalCost);
    });

    it('should validate lineup budget', async () => {
      const lineupData = {
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        totalCost: 150 // Exceeds budget of 100
      };

      mockStorage.getMatch.mockResolvedValue(testMatch);

      const response = await request(app)
        .post('/api/matches/1/lineup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('budget');
    });

    it('should validate lineup player count', async () => {
      const lineupData = {
        playerIds: [1, 2, 3], // Only 3 players, need 5
        captainId: 1,
        totalCost: 50
      };

      mockStorage.getMatch.mockResolvedValue(testMatch);

      const response = await request(app)
        .post('/api/matches/1/lineup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('5 players');
    });

    it('should get user lineup', async () => {
      const lineup = {
        id: 1,
        matchId: testMatch.id,
        userId: testUser.id,
        playerIds: [1, 2, 3, 4, 5],
        captainId: 1,
        totalCost: 75
      };

      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.getLineup.mockResolvedValue(lineup);

      const response = await request(app)
        .get('/api/matches/1/lineup')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.playerIds).toEqual([1, 2, 3, 4, 5]);
      expect(response.body.captainId).toBe(1);
    });
  });

  describe('Goal Validation and Scoring', () => {
    it('should allow league creator to validate goals', async () => {
      const goalData = {
        totalGoals: 5
      };

      mockStorage.getMatch.mockResolvedValue(testMatch);

      const response = await request(app)
        .post('/api/matches/1/validate-goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('validated');
    });

    it('should prevent non-creator from validating goals', async () => {
      const goalData = {
        totalGoals: 5
      };

      // Mock league with different creator
      const differentLeague = { ...testLeague, createdBy: 999 };
      mockStorage.getLeague.mockResolvedValue(differentLeague);

      const response = await request(app)
        .post('/api/matches/1/validate-goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should calculate match scores', async () => {
      const scores = [
        { userId: testUser.id, score: 15, lineupId: 1 },
        { userId: 2, score: 10, lineupId: 2 }
      ];

      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.calculateMatchScores.mockResolvedValue(scores);

      const response = await request(app)
        .post('/api/matches/1/calculate-scores')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });

    it('should get league rankings', async () => {
      const rankings = [
        { userId: testUser.id, username: testUser.username, totalPoints: 25 },
        { userId: 2, username: 'player2', totalPoints: 15 }
      ];

      mockStorage.getLeagueRankings.mockResolvedValue(rankings);

      const response = await request(app)
        .get(`/api/leagues/${testLeague.id}/rankings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].totalPoints).toBe(25);
    });
  });
});