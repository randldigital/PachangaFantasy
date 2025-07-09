import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '@server/routes';
import { storage } from '@server/storage';

/**
 * Comprehensive v1.0 Integration Tests
 * Tests all key user flows end-to-end with real storage interactions
 */

describe('Pachanga Fantasy v1.0 - Comprehensive Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let authToken: string;
  let testUser: any;
  let testLeague: any;
  let testMatch: any;
  let createdPlayerId: number;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterEach(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Flow 1: User Registration and Login', () => {
    it('should register a new user and login successfully', async () => {
      // Register user
      const userData = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body.user).toBeDefined();
      expect(registerResponse.body.token).toBeDefined();
      
      testUser = registerResponse.body.user;
      authToken = registerResponse.body.token;

      // Login with same credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.id).toBe(testUser.id);
      expect(loginResponse.body.token).toBeDefined();
    });

    it('should authenticate with token', async () => {
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.id).toBe(testUser.id);
    });
  });

  describe('Flow 2: League Creation and Management', () => {
    it('should create league with automatic creator-as-player', async () => {
      const leagueData = {
        name: `Test League ${Date.now()}`,
        description: 'Test league for comprehensive testing'
      };

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(leagueData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(leagueData.name);
      expect(response.body.createdBy).toBe(testUser.id);
      expect(response.body.inviteCode).toBeDefined();
      
      testLeague = response.body;

      // Verify creator was automatically added as player
      const playersResponse = await request(app)
        .get(`/api/players/${testLeague.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(playersResponse.status).toBe(200);
      const players = playersResponse.body;
      const creatorPlayer = players.find((p: any) => p.userId === testUser.id);
      expect(creatorPlayer).toBeDefined();
      expect(creatorPlayer.emoji).toBe('👑'); // Crown emoji for creator
      createdPlayerId = creatorPlayer.id;
    });

    it('should get league details with proper access control', async () => {
      const response = await request(app)
        .get(`/api/leagues/${testLeague.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testLeague.id);
    });

    it('should allow league creator to add non-user players', async () => {
      const playerData = {
        name: 'Test Player',
        emoji: '⚽'
      };

      const response = await request(app)
        .post(`/api/players/${testLeague.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(playerData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(playerData.name);
      expect(response.body.leagueId).toBe(testLeague.id);
    });
  });

  describe('Flow 3: Match Creation and Joining', () => {
    it('should create match as league creator', async () => {
      const matchData = {
        leagueId: testLeague.id,
        date: new Date('2025-07-15T19:00:00Z'),
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData);

      expect(response.status).toBe(200);
      expect(response.body.leagueId).toBe(testLeague.id);
      expect(response.body.status).toBe('open');
      
      testMatch = response.body;
    });

    it('should allow creator to join their own match', async () => {
      const response = await request(app)
        .post(`/api/matches/${testMatch.id}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.playerId).toBe(createdPlayerId);
      expect(response.body.status).toBe('accepted');
    });

    it('should get match participants', async () => {
      const response = await request(app)
        .get(`/api/matches/${testMatch.id}/participants`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Flow 4: Lineup Creation and Management', () => {
    it('should create lineup with 5 players and captain', async () => {
      // Get available players first
      const playersResponse = await request(app)
        .get(`/api/players/${testLeague.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const players = playersResponse.body;
      expect(players.length).toBeGreaterThanOrEqual(2);

      // Create lineup with available players (pad with repeated IDs if needed)
      const selectedPlayers = [...players.slice(0, 2), ...players.slice(0, 3)].slice(0, 5);
      const playerIds = selectedPlayers.map((p: any) => p.id);
      const captainId = playerIds[0];

      const lineupData = {
        playerIds,
        captainId,
        totalCost: 25 // Mock cost within budget
      };

      const response = await request(app)
        .post(`/api/matches/${testMatch.id}/lineup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(lineupData);

      expect(response.status).toBe(200);
      expect(response.body.playerIds).toEqual(playerIds);
      expect(response.body.captainId).toBe(captainId);
      expect(response.body.totalCost).toBe(25);
    });

    it('should get user lineup for match', async () => {
      const response = await request(app)
        .get(`/api/matches/${testMatch.id}/lineup`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.playerIds).toBeDefined();
      expect(response.body.captainId).toBeDefined();
    });
  });

  describe('Flow 5: Goal Validation and Scoring', () => {
    it('should allow league creator to validate goals', async () => {
      const goalData = {
        totalGoals: 3
      };

      const response = await request(app)
        .post(`/api/matches/${testMatch.id}/validate-goals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData);

      expect(response.status).toBe(200);
    });

    it('should calculate match scores', async () => {
      const response = await request(app)
        .post(`/api/matches/${testMatch.id}/calculate-scores`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get league rankings', async () => {
      const response = await request(app)
        .get(`/api/leagues/${testLeague.id}/rankings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Flow 6: Permission Model Validation', () => {
    it('should enforce league creator permissions for player addition', async () => {
      // Create second user
      const secondUserData = {
        username: `testuser2_${Date.now()}`,
        email: `test2_${Date.now()}@example.com`,
        password: 'password123'
      };

      const secondUserResponse = await request(app)
        .post('/api/auth/register')
        .send(secondUserData);

      const secondUserToken = secondUserResponse.body.token;

      // Try to add player as non-creator (should fail)
      const playerData = {
        name: 'Unauthorized Player',
        emoji: '🚫'
      };

      const response = await request(app)
        .post(`/api/players/${testLeague.id}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(playerData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should enforce league creator permissions for match creation', async () => {
      // Register second user and try to create match in first user's league
      const secondUserData = {
        username: `testuser3_${Date.now()}`,
        email: `test3_${Date.now()}@example.com`,
        password: 'password123'
      };

      const secondUserResponse = await request(app)
        .post('/api/auth/register')
        .send(secondUserData);

      const secondUserToken = secondUserResponse.body.token;

      const matchData = {
        leagueId: testLeague.id,
        date: new Date('2025-07-16T19:00:00Z'),
        lineupBudget: 100
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(matchData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });
  });
});