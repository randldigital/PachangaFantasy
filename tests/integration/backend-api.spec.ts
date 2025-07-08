import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

// Create test app instance
const createTestApp = async () => {
  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  return app;
};

describe('Backend API Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let userId: number;
  let leagueId: number;

  // Test user credentials
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    role: 'admin' as const
  };

  beforeEach(async () => {
    // Create test app
    app = await createTestApp();
    
    // Register a test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  describe('Authentication Endpoints', () => {
    test('should register a new user successfully', async () => {
      const newUser = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        role: 'player' as const
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe('newuser');
      expect(response.body.user.email).toBe('new@example.com');
      expect(response.body.user.role).toBe('player');
    });

    test('should reject registration with invalid data', async () => {
      const invalidUser = {
        username: '',
        email: 'invalid-email',
        password: '123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('should reject login with invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.username).toBe(testUser.username);
    });

    test('should reject requests without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('League Management Endpoints', () => {
    beforeEach(async () => {
      // Create a test league
      const leagueResponse = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test League',
          description: 'Test league description'
        })
        .expect(201);

      leagueId = leagueResponse.body.id;
    });

    test('should create a league successfully', async () => {
      const leagueData = {
        name: 'New Test League',
        description: 'Another test league'
      };

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(leagueData)
        .expect(201);

      expect(response.body.name).toBe(leagueData.name);
      expect(response.body.description).toBe(leagueData.description);
      expect(response.body.createdBy).toBe(userId);
      expect(response.body.inviteCode).toHaveLength(6);
    });

    test('should get user leagues', async () => {
      const response = await request(app)
        .get('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('name');
    });

    test('should get league details', async () => {
      const response = await request(app)
        .get(`/api/leagues/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(leagueId);
      expect(response.body.name).toBe('Test League');
    });

    test('should join league with invite code', async () => {
      // Get the invite code
      const leagueResponse = await request(app)
        .get(`/api/leagues/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const inviteCode = leagueResponse.body.inviteCode;

      // Create another user to join the league
      const newUser = {
        username: 'joiner',
        email: 'joiner@example.com',
        password: 'password123',
        role: 'player' as const
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      const joinerToken = userResponse.body.token;

      // Join the league
      const response = await request(app)
        .post(`/api/leagues/${inviteCode}/join`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject joining with invalid invite code', async () => {
      await request(app)
        .post('/api/leagues/INVALID/join')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Player Management Endpoints', () => {
    beforeEach(async () => {
      // Create a test league
      const leagueResponse = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Player Test League',
          description: 'Test league for players'
        })
        .expect(201);

      leagueId = leagueResponse.body.id;
    });

    test('should add user as player to league', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/add-me-as-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.name).toBe(testUser.username);
      expect(response.body.leagueId).toBe(leagueId);
      expect(response.body.userId).toBe(userId);
    });

    test('should check if user is a player in league', async () => {
      // Add user as player first
      await request(app)
        .post(`/api/leagues/${leagueId}/add-me-as-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Check if user is player
      const response = await request(app)
        .get(`/api/leagues/${leagueId}/check-user-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isPlayer).toBe(true);
      expect(response.body.player).toBeDefined();
    });

    test('should get players in league', async () => {
      // Add user as player
      await request(app)
        .post(`/api/leagues/${leagueId}/add-me-as-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Get players
      const response = await request(app)
        .get(`/api/players/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe(testUser.username);
    });

    test('should prevent duplicate player entries', async () => {
      // Add user as player first time
      await request(app)
        .post(`/api/leagues/${leagueId}/add-me-as-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Try to add again
      await request(app)
        .post(`/api/leagues/${leagueId}/add-me-as-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Tier List Endpoints', () => {
    let playerId: number;

    beforeEach(async () => {
      // Create league and add player
      const leagueResponse = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tier List Test League',
          description: 'Test league for tier lists'
        })
        .expect(201);

      leagueId = leagueResponse.body.id;

      const playerResponse = await request(app)
        .post(`/api/leagues/${leagueId}/add-me-as-player`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      playerId = playerResponse.body.id;
    });

    test('should submit tier list successfully', async () => {
      const tierListData = {
        playerOrder: [playerId],
        submitted: true
      };

      const response = await request(app)
        .post(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(tierListData)
        .expect(201);

      expect(response.body.playerOrder).toEqual([playerId]);
      expect(response.body.submitted).toBe(true);
      expect(response.body.leagueId).toBe(leagueId);
      expect(response.body.userId).toBe(userId);
    });

    test('should get tier list for user', async () => {
      // Submit tier list first
      await request(app)
        .post(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playerOrder: [playerId],
          submitted: true
        })
        .expect(201);

      // Get tier list
      const response = await request(app)
        .get(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.playerOrder).toEqual([playerId]);
      expect(response.body.submitted).toBe(true);
    });

    test('should update existing tier list', async () => {
      // Submit initial tier list
      await request(app)
        .post(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playerOrder: [playerId],
          submitted: true
        })
        .expect(201);

      // Update tier list
      const response = await request(app)
        .post(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playerOrder: [playerId],
          submitted: true
        })
        .expect(200);

      expect(response.body.playerOrder).toEqual([playerId]);
    });

    test('should reject invalid tier list data', async () => {
      await request(app)
        .post(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playerOrder: 'invalid'
        })
        .expect(400);
    });
  });

  describe('Match System Endpoints', () => {
    let matchId: number;

    beforeEach(async () => {
      // Create league
      const leagueResponse = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Match Test League',
          description: 'Test league for matches'
        })
        .expect(201);

      leagueId = leagueResponse.body.id;
    });

    test('should create match successfully', async () => {
      const matchData = {
        leagueId: leagueId,
        date: '2025-08-15T19:00:00.000Z',
        lineupBudget: 150
      };

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchData)
        .expect(201);

      expect(response.body.leagueId).toBe(leagueId);
      expect(response.body.lineupBudget).toBe(150);
      expect(response.body.createdBy).toBe(userId);
      expect(response.body.status).toBe('upcoming');

      matchId = response.body.id;
    });

    test('should get matches for league', async () => {
      // Create a match first
      await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          leagueId: leagueId,
          date: '2025-08-15T19:00:00.000Z',
          lineupBudget: 100
        })
        .expect(201);

      // Get matches
      const response = await request(app)
        .get(`/api/leagues/${leagueId}/matches`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].leagueId).toBe(leagueId);
    });

    test('should join match successfully', async () => {
      // Create match
      const matchResponse = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          leagueId: leagueId,
          date: '2025-08-15T19:00:00.000Z',
          lineupBudget: 100
        })
        .expect(201);

      matchId = matchResponse.body.id;

      // Join match
      const response = await request(app)
        .post(`/api/matches/${matchId}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.matchId).toBe(matchId);
      expect(response.body.userId).toBe(userId);
      expect(response.body.status).toBe('accepted');
    });

    test('should get match details with participants', async () => {
      // Create and join match
      const matchResponse = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          leagueId: leagueId,
          date: '2025-08-15T19:00:00.000Z',
          lineupBudget: 100
        })
        .expect(201);

      matchId = matchResponse.body.id;

      await request(app)
        .post(`/api/matches/${matchId}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Get match details
      const response = await request(app)
        .get(`/api/matches/${matchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(matchId);
      expect(response.body.participants).toBeDefined();
      expect(Array.isArray(response.body.participants)).toBe(true);
      expect(response.body.participants.length).toBe(1);
    });
  });
});