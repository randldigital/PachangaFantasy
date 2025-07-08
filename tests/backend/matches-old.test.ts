import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { registerRoutes } from '@server/routes';
import { createMockUser, createMockMatch, createMockPlayer } from '../test-utils';

// Mock the storage
vi.mock('@server/storage', () => {
  const mockStorage = {
    getUser: vi.fn(),
    createMatch: vi.fn(),
    getMatchesByLeague: vi.fn(),
    getMatch: vi.fn(),
    joinMatch: vi.fn(),
    getMatchParticipants: vi.fn(),
    balanceTeams: vi.fn(),
    updateMatch: vi.fn(),
    createLineup: vi.fn(),
    getLineup: vi.fn(),
    updateLineup: vi.fn(),
    createStatReport: vi.fn(),
    getStatReportsForMatch: vi.fn(),
    verifyStatReport: vi.fn(),
    calculateMatchScores: vi.fn(),
    getLeagueRankings: vi.fn(),
  };
  
  return {
    DatabaseStorage: vi.fn(() => mockStorage),
    storage: mockStorage,
  };
});

describe('Match Routes', () => {
  let app: express.Application;
  let mockStorage: any;
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Get the mocked storage instance
    const { storage } = await import('@server/storage');
    mockStorage = storage;
    
    // Register routes
    await registerRoutes(app);

    // Create test user and token
    testUser = createMockUser();
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    
    // Mock getUser for authentication
    mockStorage.getUser.mockResolvedValue(testUser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/matches', () => {
    it('should create a new match successfully', async () => {
      const matchData = {
        leagueId: 1,
        date: new Date('2025-01-15T10:00:00Z'),
        lineupBudget: 100
      };

      const createdMatch = createMockMatch(matchData);
      mockStorage.createMatch.mockResolvedValue(createdMatch);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdMatch);
      expect(mockStorage.createMatch).toHaveBeenCalledWith(matchData);
    });

    it('should validate match data', async () => {
      const invalidMatchData = {
        leagueId: 'invalid', // Should be number
        date: 'invalid-date',
        lineupBudget: -10 // Should be positive
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMatchData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
    });
  });

  describe('GET /api/leagues/:leagueId/matches', () => {
    it('should return matches for a league', async () => {
      const leagueId = 1;
      const matches = [
        createMockMatch({ id: 1, leagueId }),
        createMockMatch({ id: 2, leagueId, status: 'completed' })
      ];

      mockStorage.getMatchesByLeague.mockResolvedValue(matches);

      const response = await request(app)
        .get(`/api/leagues/${leagueId}/matches`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(matches);
      expect(mockStorage.getMatchesByLeague).toHaveBeenCalledWith(leagueId);
    });
  });

  describe('GET /api/matches/:id', () => {
    it('should return match with participants', async () => {
      const match = createMockMatch({ id: 1 });
      const participants = [
        { id: 1, matchId: 1, userId: 1, accepted: true },
        { id: 2, matchId: 1, userId: 2, accepted: false }
      ];

      mockStorage.getMatch.mockResolvedValue(match);
      mockStorage.getMatchParticipants.mockResolvedValue(participants);

      const response = await request(app)
        .get('/api/matches/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...match, participants });
    });

    it('should return 404 for non-existent match', async () => {
      mockStorage.getMatch.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Match not found');
    });
  });

  describe('POST /api/matches/:id/join', () => {
    it('should join match successfully', async () => {
      const matchId = 1;
      const participant = { id: 1, matchId, userId: testUser.id, accepted: true };
      const participants = [participant]; // Only one participant

      mockStorage.joinMatch.mockResolvedValue(participant);
      mockStorage.getMatchParticipants.mockResolvedValue(participants);

      const response = await request(app)
        .post(`/api/matches/${matchId}/join`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(participant);
      expect(mockStorage.joinMatch).toHaveBeenCalledWith(matchId, testUser.id);
    });

    it('should balance teams when 10 players join', async () => {
      const matchId = 1;
      const participant = { id: 10, matchId, userId: testUser.id, accepted: true };
      
      // Mock 10 participants (including the new one)
      const participants = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        matchId,
        userId: i + 1,
        accepted: true
      }));

      const balancedTeams = {
        teamA: [1, 2, 3, 4, 5],
        teamB: [6, 7, 8, 9, 10]
      };

      mockStorage.joinMatch.mockResolvedValue(participant);
      mockStorage.getMatchParticipants.mockResolvedValue(participants);
      mockStorage.balanceTeams.mockResolvedValue(balancedTeams);
      mockStorage.updateMatch.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/matches/${matchId}/join`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockStorage.balanceTeams).toHaveBeenCalledWith(
        matchId, 
        participants.map(p => p.userId)
      );
      expect(mockStorage.updateMatch).toHaveBeenCalledWith(matchId, { status: 'ready' });
    });
  });

  describe('POST /api/matches/:matchId/lineup', () => {
    it('should create lineup successfully', async () => {
      const matchId = 1;
      const lineupData = {
        playerIds: [1, 2, 3, 4, 5],
        totalCost: 80
      };

      const createdLineup = {
        id: 1,
        matchId,
        userId: testUser.id,
        ...lineupData,
        createdAt: new Date()
      };

      mockStorage.getLineup.mockResolvedValue(null); // No existing lineup
      mockStorage.createLineup.mockResolvedValue(createdLineup);

      const response = await request(app)
        .post(`/api/matches/${matchId}/lineup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdLineup);
      expect(mockStorage.createLineup).toHaveBeenCalledWith({
        ...lineupData,
        matchId,
        userId: testUser.id
      });
    });

    it('should update existing lineup', async () => {
      const matchId = 1;
      const lineupData = {
        playerIds: [1, 2, 3, 4, 5],
        totalCost: 80
      };

      const existingLineup = {
        id: 1,
        matchId,
        userId: testUser.id,
        playerIds: [6, 7, 8, 9, 10],
        totalCost: 90,
        createdAt: new Date()
      };

      const updatedLineup = { ...existingLineup, ...lineupData };

      mockStorage.getLineup.mockResolvedValue(existingLineup);
      mockStorage.updateLineup.mockResolvedValue(updatedLineup);

      const response = await request(app)
        .post(`/api/matches/${matchId}/lineup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedLineup);
      expect(mockStorage.updateLineup).toHaveBeenCalledWith(
        existingLineup.id,
        { ...lineupData, matchId, userId: testUser.id }
      );
    });
  });

  describe('POST /api/matches/:matchId/stats', () => {
    it('should submit stat report successfully', async () => {
      const matchId = 1;
      const statData = {
        goals: 2,
        assists: 1
      };

      const createdStatReport = {
        id: 1,
        matchId,
        userId: testUser.id,
        ...statData,
        verifiedBy: null,
        verifiedStatus: null,
        createdAt: new Date()
      };

      mockStorage.createStatReport.mockResolvedValue(createdStatReport);

      const response = await request(app)
        .post(`/api/matches/${matchId}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdStatReport);
      expect(mockStorage.createStatReport).toHaveBeenCalledWith({
        ...statData,
        matchId,
        userId: testUser.id
      });
    });
  });

  describe('POST /api/stats/:reportId/verify', () => {
    it('should verify stat report successfully', async () => {
      const reportId = 1;
      const verificationData = { status: 'confirmed' as const };

      const verifiedReport = {
        id: reportId,
        matchId: 1,
        userId: 2,
        goals: 2,
        assists: 1,
        verifiedBy: testUser.id,
        verifiedStatus: 'confirmed',
        createdAt: new Date()
      };

      mockStorage.verifyStatReport.mockResolvedValue(verifiedReport);

      const response = await request(app)
        .post(`/api/stats/${reportId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(verifiedReport);
      expect(mockStorage.verifyStatReport).toHaveBeenCalledWith(
        reportId,
        testUser.id,
        'confirmed'
      );
    });
  });

  describe('POST /api/matches/:matchId/calculate-scores', () => {
    it('should calculate match scores successfully', async () => {
      const matchId = 1;
      const scores = [
        { id: 1, userId: 1, matchId, points: 8, createdAt: new Date() },
        { id: 2, userId: 2, matchId, points: 5, createdAt: new Date() }
      ];

      mockStorage.calculateMatchScores.mockResolvedValue(scores);
      mockStorage.updateMatch.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/matches/${matchId}/calculate-scores`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(scores);
      expect(mockStorage.calculateMatchScores).toHaveBeenCalledWith(matchId);
      expect(mockStorage.updateMatch).toHaveBeenCalledWith(matchId, { status: 'completed' });
    });
  });

  describe('GET /api/leagues/:leagueId/rankings', () => {
    it('should return league rankings', async () => {
      const leagueId = 1;
      const rankings = [
        { userId: 1, username: 'player1', totalPoints: 25 },
        { userId: 2, username: 'player2', totalPoints: 18 },
        { userId: 3, username: 'player3', totalPoints: 12 }
      ];

      mockStorage.getLeagueRankings.mockResolvedValue(rankings);

      const response = await request(app)
        .get(`/api/leagues/${leagueId}/rankings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(rankings);
      expect(mockStorage.getLeagueRankings).toHaveBeenCalledWith(leagueId);
    });
  });
});