import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { registerRoutes } from '@server/routes';
import { createMockUser, createMockLeague } from '../test-utils';

// Mock the storage
vi.mock('@server/storage', () => {
  const mockStorage = {
    getUser: vi.fn(),
    createLeague: vi.fn(),
    getUserLeagues: vi.fn(),
    getLeague: vi.fn(),
    getLeagueByInviteCode: vi.fn(),
    updateLeague: vi.fn(),
  };
  
  return {
    DatabaseStorage: vi.fn(() => mockStorage),
    storage: mockStorage,
  };
});

describe('League Routes', () => {
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

  describe('POST /api/leagues', () => {
    it('should create a new league successfully', async () => {
      const leagueData = {
        name: 'Test League',
        description: 'A test league'
      };

      const createdLeague = createMockLeague({
        ...leagueData,
        createdBy: testUser.id
      });

      mockStorage.createLeague.mockResolvedValue(createdLeague);

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(leagueData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdLeague);
      expect(mockStorage.createLeague).toHaveBeenCalledWith(
        expect.objectContaining(leagueData),
        testUser.id
      );
    });

    it('should require authentication', async () => {
      const leagueData = {
        name: 'Test League',
        description: 'A test league'
      };

      const response = await request(app)
        .post('/api/leagues')
        .send(leagueData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });

    it('should validate league data', async () => {
      const invalidLeagueData = {
        name: '', // Empty name should fail validation
        description: 'A test league'
      };

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidLeagueData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input');
    });
  });

  describe('GET /api/leagues', () => {
    it('should return user leagues', async () => {
      const userLeagues = [
        createMockLeague({ id: 1 }),
        createMockLeague({ id: 2, name: 'Second League' })
      ];

      mockStorage.getUserLeagues.mockResolvedValue(userLeagues);

      const response = await request(app)
        .get('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(userLeagues);
      expect(mockStorage.getUserLeagues).toHaveBeenCalledWith(testUser.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/leagues');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/leagues/:id', () => {
    it('should return specific league', async () => {
      const league = createMockLeague({ id: 1 });
      mockStorage.getLeague.mockResolvedValue(league);

      const response = await request(app)
        .get('/api/leagues/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(league);
      expect(mockStorage.getLeague).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent league', async () => {
      mockStorage.getLeague.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/leagues/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });
  });

  describe('POST /api/leagues/:inviteCode/join', () => {
    it('should join league with valid invite code', async () => {
      const league = createMockLeague({ 
        id: 1, 
        inviteCode: 'TEST123',
        participants: []
      });
      
      const updatedLeague = {
        ...league,
        participants: [testUser.id]
      };

      mockStorage.getLeagueByInviteCode.mockResolvedValue(league);
      mockStorage.updateLeague.mockResolvedValue(updatedLeague);

      const response = await request(app)
        .post('/api/leagues/TEST123/join')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedLeague);
      expect(mockStorage.getLeagueByInviteCode).toHaveBeenCalledWith('TEST123');
      expect(mockStorage.updateLeague).toHaveBeenCalledWith(
        league.id,
        { participants: [testUser.id] }
      );
    });

    it('should return error for invalid invite code', async () => {
      mockStorage.getLeagueByInviteCode.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/leagues/INVALID/join')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });

    it('should not allow joining if already a participant', async () => {
      const league = createMockLeague({ 
        id: 1, 
        inviteCode: 'TEST123',
        participants: [testUser.id] // User already in league
      });

      mockStorage.getLeagueByInviteCode.mockResolvedValue(league);

      const response = await request(app)
        .post('/api/leagues/TEST123/join')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Already a member of this league');
    });
  });
});