import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';
import { DatabaseStorage } from '../../server/storage';

// Mock the storage
vi.mock('../../server/storage', () => {
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

describe('Match System API', () => {
  let app: Express;
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
    testUser = { id: 1, username: 'testuser', email: 'test@example.com', role: 'player' };
    testLeague = { id: 1, name: 'Test League', createdBy: testUser.id, inviteCode: 'ABC123', status: 'open' };
    testMatch = { id: 1, leagueId: testLeague.id, date: new Date('2025-07-15T19:00:00Z'), status: 'open', lineupBudget: 100, createdBy: testUser.id };
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    mockStorage.getUser.mockResolvedValue(testUser);
    mockStorage.getLeague.mockResolvedValue(testLeague);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Match Creation', () => {
    it('creates match as league creator', async () => {
      const matchData = { leagueId: testLeague.id, date: new Date('2025-07-15T19:00:00Z'), lineupBudget: 100 };
      mockStorage.createMatch.mockResolvedValue(testMatch);
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(200);
      expect(res.body.leagueId).toBe(testLeague.id);
      expect(res.body.status).toBe('open');
      expect(res.body.createdBy).toBe(testUser.id);
    });
    it('prevents non-creator from creating matches', async () => {
      const matchData = { leagueId: testLeague.id, date: new Date('2025-07-15T19:00:00Z'), lineupBudget: 100 };
      const differentLeague = { ...testLeague, createdBy: 999 };
      mockStorage.getLeague.mockResolvedValue(differentLeague);
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only league creator');
    });
    it('gets match by ID', async () => {
      mockStorage.getMatch.mockResolvedValue(testMatch);
      const res = await request(app)
        .get('/api/matches/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.leagueId).toBe(testLeague.id);
    });
    it('gets matches by league', async () => {
      const matches = [testMatch];
      mockStorage.getMatchesByLeague.mockResolvedValue(matches);
      const res = await request(app)
        .get(`/api/leagues/${testLeague.id}/matches`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('Match Participation', () => {
    it('allows user to join match', async () => {
      const userPlayer = { id: 1, name: testUser.username, userId: testUser.id, leagueId: testLeague.id };
      const participant = { id: 1, matchId: testMatch.id, playerId: userPlayer.id, status: 'accepted' };
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.checkUserAsPlayer.mockResolvedValue(userPlayer);
      mockStorage.joinMatch.mockResolvedValue(participant);
      const res = await request(app)
        .post('/api/matches/1/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.playerId).toBe(userPlayer.id);
      expect(res.body.status).toBe('accepted');
    });
    it('prevents joining without player record', async () => {
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.checkUserAsPlayer.mockResolvedValue(undefined);
      const res = await request(app)
        .post('/api/matches/1/join')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('player record');
    });
    it('gets match participants', async () => {
      const participants = [
        { id: 1, matchId: testMatch.id, playerId: 1, status: 'accepted', player: { id: 1, name: 'Player 1', emoji: '\u26bd' } }
      ];
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.getMatchParticipants.mockResolvedValue(participants);
      const res = await request(app)
        .get('/api/matches/1/participants')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('Lineup System', () => {
    it('creates lineup for match participant', async () => {
      const lineupData = { playerIds: [1, 2, 3, 4, 5], captainId: 1, totalCost: 75 };
      const lineup = { id: 1, matchId: testMatch.id, userId: testUser.id, ...lineupData };
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.createLineup.mockResolvedValue(lineup);
      const res = await request(app)
        .post('/api/matches/1/lineup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);
      expect(res.status).toBe(200);
      expect(res.body.playerIds).toEqual(lineupData.playerIds);
      expect(res.body.captainId).toBe(lineupData.captainId);
      expect(res.body.totalCost).toBe(lineupData.totalCost);
    });
    it('validates lineup budget', async () => {
      const lineupData = { playerIds: [1, 2, 3, 4, 5], captainId: 1, totalCost: 150 };
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.createLineup.mockRejectedValue(new Error('Budget exceeded'));
      const res = await request(app)
        .post('/api/matches/1/lineup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);
      expect(res.status).toBe(400);
    });
  });

  describe('Stat Reporting & Scoring', () => {
    it('creates stat report for participant', async () => {
      const statData = { goals: 2, assists: 1 };
      const statReport = { id: 1, matchId: testMatch.id, userId: testUser.id, ...statData };
      mockStorage.getMatch.mockResolvedValue(testMatch);
      mockStorage.createStatReport.mockResolvedValue(statReport);
      const res = await request(app)
        .post('/api/matches/1/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .send(statData);
      expect(res.status).toBe(200);
      expect(res.body.goals).toBe(2);
      expect(res.body.assists).toBe(1);
    });
    it('calculates match scores as admin', async () => {
      const scores = [{ userId: 1, score: 10 }];
      mockStorage.getMatch.mockResolvedValue({ ...testMatch, status: 'completed' });
      mockStorage.calculateMatchScores.mockResolvedValue(scores);
      const res = await request(app)
        .post('/api/matches/1/calculate-scores')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].score).toBe(10);
    });
  });
});