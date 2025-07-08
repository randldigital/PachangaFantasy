import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('Working API Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    // Create test app instance
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    // Register a unique test user
    const timestamp = Date.now();
    const testUser = {
      username: `testuser${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'password123',
      role: 'admin' as const
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.token).toBeDefined();
    
    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  describe('Authentication Flow', () => {
    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(userId);
    });

    test('should reject requests without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('League Management', () => {
    let leagueId: number;

    test('should create a league successfully', async () => {
      const leagueData = {
        name: 'Test League',
        description: 'A test league'
      };

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .send(leagueData)
        .expect(201);

      expect(response.body.name).toBe(leagueData.name);
      expect(response.body.inviteCode).toBeDefined();
      leagueId = response.body.id;
    });

    test('should get user leagues', async () => {
      const response = await request(app)
        .get('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should get league details', async () => {
      if (!leagueId) return;

      const response = await request(app)
        .get(`/api/leagues/${leagueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(leagueId);
      expect(response.body.name).toBe('Test League');
    });
  });

  describe('Player Management', () => {
    test('should add user as player to league', async () => {
      // Assuming we have a league from previous tests
      const leagues = await request(app)
        .get('/api/leagues')
        .set('Authorization', `Bearer ${authToken}`);

      if (leagues.body.length > 0) {
        const leagueId = leagues.body[0].id;

        const response = await request(app)
          .post(`/api/leagues/${leagueId}/add-me-as-player`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        expect(response.body.userId).toBe(userId);
        expect(response.body.leagueId).toBe(leagueId);
      }
    });
  });
});