import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '@server/routes';
import { DatabaseStorage } from '@server/storage';

// Mock the storage
vi.mock('@server/storage', () => {
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

describe('League Management Routes', () => {
  let app: express.Application;
  let mockStorage: any;
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Get the mocked storage instance
    mockStorage = new DatabaseStorage();
    
    // Register routes
    await registerRoutes(app);

    // Create test user and token
    testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'player'
    };

    // Mock JWT for testing
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'pachanga-secret-key');
    
    // Mock getUser for auth middleware
    mockStorage.getUser.mockResolvedValue(testUser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/leagues', () => {
    it('should create league successfully', async () => {
      const leagueData = {
        name: 'Test League',
        description: 'Test description'
      };

      const createdLeague = {
        id: 1,
        name: 'Test League',
        description: 'Test description',
        createdBy: testUser.id,
        inviteCode: 'ABC123',
        status: 'open'
      };

      mockStorage.createLeague.mockResolvedValue(createdLeague);

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(leagueData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(leagueData.name);
      expect(response.body.createdBy).toBe(testUser.id);
      expect(response.body.inviteCode).toBeDefined();
    });

    it('should require authentication', async () => {
      const leagueData = {
        name: 'Test League',
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/leagues')
        .send(leagueData);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const invalidLeagueData = {
        name: '', // Empty name
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidLeagueData);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/leagues/:id', () => {
    it('should get league details', async () => {
      const league = {
        id: 1,
        name: 'Test League',
        description: 'Test description',
        createdBy: testUser.id,
        inviteCode: 'ABC123',
        status: 'open'
      };

      mockStorage.getLeague.mockResolvedValue(league);

      const response = await request(app)
        .get('/api/leagues/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Test League');
    });

    it('should return 404 for non-existent league', async () => {
      mockStorage.getLeague.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/leagues/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/leagues', () => {
    it('should get user leagues', async () => {
      const leagues = [
        {
          id: 1,
          name: 'League 1',
          description: 'Description 1',
          createdBy: testUser.id,
          inviteCode: 'ABC123',
          status: 'open'
        },
        {
          id: 2,
          name: 'League 2', 
          description: 'Description 2',
          createdBy: 2,
          inviteCode: 'DEF456',
          status: 'open'
        }
      ];

      mockStorage.getUserLeagues.mockResolvedValue(leagues);

      const response = await request(app)
        .get('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('Player Management', () => {
    it('should add player as league creator', async () => {
      const playerData = {
        name: 'Test Player',
        emoji: '⚽'
      };

      const createdPlayer = {
        id: 1,
        name: 'Test Player',
        emoji: '⚽',
        leagueId: 1,
        marketValue: 50,
        userId: null,
        createdBy: testUser.id
      };

      // Mock league with user as creator
      const league = {
        id: 1,
        name: 'Test League',
        createdBy: testUser.id
      };

      mockStorage.getLeague.mockResolvedValue(league);
      mockStorage.createPlayer.mockResolvedValue(createdPlayer);

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(playerData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(playerData.name);
      expect(response.body.leagueId).toBe(1);
    });

    it('should prevent non-creator from adding players', async () => {
      const playerData = {
        name: 'Test Player',
        emoji: '⚽'
      };

      // Mock league with different creator
      const league = {
        id: 1,
        name: 'Test League',
        createdBy: 999 // Different user
      };

      mockStorage.getLeague.mockResolvedValue(league);

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(playerData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should get league players', async () => {
      const players = [
        {
          id: 1,
          name: 'Player 1',
          emoji: '⚽',
          leagueId: 1,
          marketValue: 75,
          userId: testUser.id
        },
        {
          id: 2,
          name: 'Player 2',
          emoji: '🥅',
          leagueId: 1,
          marketValue: 60,
          userId: null
        }
      ];

      mockStorage.getPlayersByLeague.mockResolvedValue(players);

      const response = await request(app)
        .get('/api/players/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });

    it('should allow user to add themselves as player', async () => {
      const league = {
        id: 1,
        name: 'Test League',
        createdBy: testUser.id
      };

      const createdPlayer = {
        id: 1,
        name: testUser.username,
        emoji: '🏃',
        leagueId: 1,
        marketValue: 50,
        userId: testUser.id,
        createdBy: testUser.id
      };

      mockStorage.getLeague.mockResolvedValue(league);
      mockStorage.checkUserAsPlayer.mockResolvedValue(undefined); // Not already a player
      mockStorage.createPlayer.mockResolvedValue(createdPlayer);

      const response = await request(app)
        .post('/api/leagues/1/add-me-as-player')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.name).toBe(testUser.username);
    });

    it('should prevent duplicate user-player records', async () => {
      const league = {
        id: 1,
        name: 'Test League',
        createdBy: testUser.id
      };

      const existingPlayer = {
        id: 1,
        name: testUser.username,
        userId: testUser.id,
        leagueId: 1
      };

      mockStorage.getLeague.mockResolvedValue(league);
      mockStorage.checkUserAsPlayer.mockResolvedValue(existingPlayer); // Already a player

      const response = await request(app)
        .post('/api/leagues/1/add-me-as-player')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already a player');
    });
  });
});