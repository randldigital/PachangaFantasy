import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';
import { DatabaseStorage } from '../../server/storage';

// Mock the storage
vi.mock('../../server/storage', () => {
  const mockStorage = {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    authenticateUser: vi.fn(),
    getUser: vi.fn(),
    createLeague: vi.fn(),
    getLeague: vi.fn(),
    getUserLeagues: vi.fn(),
    createPlayer: vi.fn(),
    getPlayersByLeague: vi.fn(),
    checkUserAsPlayer: vi.fn(),
  };
  return {
    DatabaseStorage: vi.fn(() => mockStorage),
    storage: mockStorage,
  };
});

describe('League Management API', () => {
  let app: Express;
  let mockStorage: any;
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    mockStorage = new DatabaseStorage();
    await registerRoutes(app);
    testUser = { id: 1, username: 'testuser', email: 'test@example.com', role: 'player' };
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    mockStorage.getUser.mockResolvedValue(testUser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/leagues', () => {
    it('creates league successfully', async () => {
      const leagueData = { name: 'Test League', description: 'Test description' };
      const createdLeague = { id: 1, name: 'Test League', description: 'Test description', createdBy: testUser.id, inviteCode: 'ABC123', status: 'open' };
      mockStorage.createLeague.mockResolvedValue(createdLeague);
      mockStorage.createPlayer.mockResolvedValue({ id: 1, name: testUser.username, leagueId: createdLeague.id, userId: testUser.id });
      const res = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(leagueData);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(leagueData.name);
      expect(res.body.createdBy).toBe(testUser.id);
      expect(res.body.inviteCode).toBeDefined();
    });
    it('requires authentication', async () => {
      const leagueData = { name: 'Test League', description: 'Test description' };
      const res = await request(app).post('/api/leagues').send(leagueData);
      expect(res.status).toBe(401);
    });
    it('validates required fields', async () => {
      const invalidLeagueData = { name: '', description: 'Test description' };
      const res = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidLeagueData);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/leagues/:id', () => {
    it('gets league details', async () => {
      const league = { id: 1, name: 'Test League', description: 'Test description', createdBy: testUser.id, inviteCode: 'ABC123', status: 'open' };
      mockStorage.getLeague.mockResolvedValue(league);
      const res = await request(app)
        .get('/api/leagues/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.name).toBe('Test League');
    });
    it('returns 404 for non-existent league', async () => {
      mockStorage.getLeague.mockResolvedValue(undefined);
      const res = await request(app)
        .get('/api/leagues/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/leagues', () => {
    it('gets user leagues', async () => {
      const leagues = [
        { id: 1, name: 'League 1', description: 'Description 1', createdBy: testUser.id, inviteCode: 'ABC123', status: 'open' },
        { id: 2, name: 'League 2', description: 'Description 2', createdBy: 2, inviteCode: 'DEF456', status: 'open' }
      ];
      mockStorage.getUserLeagues.mockResolvedValue(leagues);
      const res = await request(app)
        .get('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('Player Management', () => {
    it('adds player as league creator', async () => {
      const playerData = { name: 'Test Player', emoji: '\u26bd' };
      const createdPlayer = { id: 1, name: 'Test Player', emoji: '\u26bd', leagueId: 1, marketValue: 50, userId: null, createdBy: testUser.id };
      const league = { id: 1, name: 'Test League', createdBy: testUser.id };
      mockStorage.getLeague.mockResolvedValue(league);
      mockStorage.createPlayer.mockResolvedValue(createdPlayer);
      const res = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(playerData);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(playerData.name);
      expect(res.body.leagueId).toBe(1);
    });
    it('prevents non-creator from adding players', async () => {
      const playerData = { name: 'Test Player', emoji: '\u26bd' };
      const league = { id: 1, name: 'Test League', createdBy: 999 };
      mockStorage.getLeague.mockResolvedValue(league);
      const res = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(playerData);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only league creator');
    });
    it('gets league players', async () => {
      const players = [
        { id: 1, name: 'Player 1', emoji: '\u26bd', leagueId: 1 },
        { id: 2, name: 'Player 2', emoji: '\u26bd', leagueId: 1 }
      ];
      mockStorage.getPlayersByLeague.mockResolvedValue(players);
      const league = { id: 1, name: 'Test League', createdBy: testUser.id };
      mockStorage.getLeague.mockResolvedValue(league);
      const res = await request(app)
        .get('/api/leagues/1/players')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });
});