import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage';
import { createMockUser, createMockLeague, createMockMatch } from '../mocks/mockData';

// Mock the storage
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
    getLeague: vi.fn(),
    createMatch: vi.fn(),
    checkUserAsPlayer: vi.fn(),
    createPlayer: vi.fn(),
  }
}));

const mockStorage = storage as any;

describe('Match Creation API', () => {
  let app: Express;
  let testUser: any;
  let testLeague: any;
  let authToken: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    testUser = createMockUser({ role: 'admin' });
    testLeague = createMockLeague({ createdBy: testUser.id });
    authToken = require('jsonwebtoken').sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    mockStorage.getUser.mockResolvedValue(testUser);
    mockStorage.getLeague.mockResolvedValue(testLeague);
    mockStorage.checkUserAsPlayer.mockResolvedValue({ id: 1, name: testUser.username, userId: testUser.id });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Date Validation', () => {
    it('accepts valid ISO date string', async () => {
      const matchData = { leagueId: testLeague.id, date: '2025-01-15T10:00:00.000Z', lineupBudget: 100 };
      const createdMatch = createMockMatch({ ...matchData, date: new Date(matchData.date) });
      mockStorage.createMatch.mockResolvedValue(createdMatch);
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(createdMatch);
      expect(mockStorage.createMatch).toHaveBeenCalledWith({ ...matchData, date: new Date(matchData.date), createdBy: testUser.id });
    });
    it('accepts date string without timezone', async () => {
      const matchData = { leagueId: testLeague.id, date: '2025-01-15T10:00:00', lineupBudget: 100 };
      const createdMatch = createMockMatch({ ...matchData, date: new Date(matchData.date) });
      mockStorage.createMatch.mockResolvedValue(createdMatch);
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(createdMatch);
    });
    it('accepts date string from form input', async () => {
      const matchData = { leagueId: testLeague.id, date: '2025-01-15T19:00', lineupBudget: 100 };
      const createdMatch = createMockMatch({ ...matchData, date: new Date(matchData.date) });
      mockStorage.createMatch.mockResolvedValue(createdMatch);
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(createdMatch);
    });
    it('rejects invalid date format', async () => {
      const matchData = { leagueId: testLeague.id, date: 'invalid-date-format', lineupBudget: 100 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid input');
      expect(res.body.errors).toBeDefined();
    });
    it('rejects empty date', async () => {
      const matchData = { leagueId: testLeague.id, date: '', lineupBudget: 100 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid input');
    });
    it('rejects missing date field', async () => {
      const matchData = { leagueId: testLeague.id, lineupBudget: 100 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid input');
    });
  });

  describe('Budget Validation', () => {
    it('accepts valid budget values', async () => {
      const testBudgets = [50, 100, 150, 200, 500];
      for (const budget of testBudgets) {
        const matchData = { leagueId: testLeague.id, date: '2025-01-15T10:00:00Z', lineupBudget: budget };
        const createdMatch = createMockMatch({ ...matchData, date: new Date(matchData.date) });
        mockStorage.createMatch.mockResolvedValue(createdMatch);
        const res = await request(app)
          .post('/api/matches')
          .set('Authorization', `Bearer ${authToken}`)
          .send(matchData);
        expect(res.status).toBe(200);
        expect(res.body.lineupBudget).toBe(budget);
      }
    });
    it('rejects budget below minimum', async () => {
      const matchData = { leagueId: testLeague.id, date: '2025-01-15T10:00:00Z', lineupBudget: 49 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid input');
      expect(res.body.errors[0].message).toContain('Budget must be at least 50');
    });
    it('rejects budget above maximum', async () => {
      const matchData = { leagueId: testLeague.id, date: '2025-01-15T10:00:00Z', lineupBudget: 501 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid input');
      expect(res.body.errors[0].message).toContain('Budget cannot exceed 500');
    });
  });

  describe('League Validation', () => {
    it('rejects non-existent league', async () => {
      mockStorage.getLeague.mockResolvedValue(null);
      const matchData = { leagueId: 999, date: '2025-01-15T10:00:00Z', lineupBudget: 100 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('League not found');
    });
    it('rejects non-creator user', async () => {
      const nonCreatorUser = createMockUser({ id: 999 });
      const nonCreatorToken = require('jsonwebtoken').sign({ userId: nonCreatorUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
      mockStorage.getUser.mockResolvedValue(nonCreatorUser);
      const matchData = { leagueId: testLeague.id, date: '2025-01-15T10:00:00Z', lineupBudget: 100 };
      const res = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${nonCreatorToken}`)
        .send(matchData);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only league creator');
    });
  });
});