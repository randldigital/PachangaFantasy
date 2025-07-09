import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../server/index';
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
  let testUser: any;
  let testLeague: any;
  let authToken: string;

  beforeEach(() => {
    // Create test user and league
    testUser = createMockUser({ role: 'admin' });
    testLeague = createMockLeague({ createdBy: testUser.id });
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    
    // Mock storage methods
    mockStorage.getUser.mockResolvedValue(testUser);
    mockStorage.getLeague.mockResolvedValue(testLeague);
    mockStorage.checkUserAsPlayer.mockResolvedValue({ id: 1, name: testUser.username, userId: testUser.id });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Date Validation', () => {
    it('should accept valid ISO date string', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00.000Z',
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
      expect(mockStorage.createMatch).toHaveBeenCalledWith({
        ...matchData,
        date: new Date(matchData.date),
        createdBy: testUser.id
      });
    });

    it('should accept date string without timezone', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00',
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
    });

    it('should accept date string from form input', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T19:00', // Common format from datetime-local input
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
    });

    it('should reject invalid date format', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: 'invalid-date-format',
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
      expect(response.body.errors).toBeDefined();
    });

    it('should reject empty date', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '',
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
    });

    it('should reject missing date field', async () => {
      const matchData = {
        leagueId: testLeague.id,
        lineupBudget: 100
        // date field missing
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
    });
  });

  describe('Budget Validation', () => {
    it('should accept valid budget values', async () => {
      const testBudgets = [50, 100, 150, 200, 500];
      
      for (const budget of testBudgets) {
        const matchData = {
          leagueId: testLeague.id,
          date: '2025-01-15T10:00:00Z',
          lineupBudget: budget
        };

        const createdMatch = createMockMatch(matchData);
        mockStorage.createMatch.mockResolvedValue(createdMatch);

        const response = await request(app)
          .post('/api/matches')
          .set('Authorization', `Bearer ${authToken}`)
          .send(matchData);

        expect(response.status).toBe(200);
        expect(response.body.lineupBudget).toBe(budget);
      }
    });

    it('should reject budget below minimum', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 49
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
      expect(response.body.errors[0].message).toContain('Budget must be at least 50');
    });

    it('should reject budget above maximum', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 501
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
      expect(response.body.errors[0].message).toContain('Budget cannot exceed 500');
    });
  });

  describe('League Validation', () => {
    it('should reject non-existent league', async () => {
      mockStorage.getLeague.mockResolvedValue(null);

      const matchData = {
        leagueId: 999,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });

    it('should reject non-creator user', async () => {
      const nonCreatorUser = createMockUser({ id: 999 });
      const nonCreatorToken = jwt.sign({ userId: nonCreatorUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
      
      mockStorage.getUser.mockResolvedValue(nonCreatorUser);

      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${nonCreatorToken}`)
        .send(matchData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only league creator can create matches');
    });
  });

  describe('Player Record Creation', () => {
    it('should create player record for creator if missing', async () => {
      // Mock no existing player record
      mockStorage.checkUserAsPlayer.mockResolvedValue(null);
      
      const createdPlayer = { id: 1, name: testUser.username, userId: testUser.id };
      mockStorage.createPlayer.mockResolvedValue(createdPlayer);

      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      };

      const createdMatch = createMockMatch(matchData);
      mockStorage.createMatch.mockResolvedValue(createdMatch);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(200);
      expect(mockStorage.createPlayer).toHaveBeenCalledWith({
        name: testUser.username,
        emoji: '👑',
        leagueId: testLeague.id,
        userId: testUser.id,
        createdBy: testUser.id
      });
    });

    it('should not create duplicate player record if exists', async () => {
      // Mock existing player record
      const existingPlayer = { id: 1, name: testUser.username, userId: testUser.id };
      mockStorage.checkUserAsPlayer.mockResolvedValue(existingPlayer);

      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      };

      const createdMatch = createMockMatch(matchData);
      mockStorage.createMatch.mockResolvedValue(createdMatch);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(200);
      expect(mockStorage.createPlayer).not.toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .send(matchData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    it('should reject requests with invalid token', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', 'Bearer invalid-token')
        .send(matchData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });
  });
});