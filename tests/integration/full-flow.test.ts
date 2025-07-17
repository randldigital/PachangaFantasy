import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '@server/routes';

// Comprehensive integration test that tests the complete Pachanga Fantasy flow
describe('Full Pachanga Fantasy Flow Integration', () => {
  let app: express.Application;
  let userToken: string;
  let leagueId: number;
  let playerId: number;
  let matchId: number;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it('should complete the entire Pachanga Fantasy flow', async () => {
    // Step 1: User Registration
    const userData = {
      username: 'flowuser',
      email: 'flow@test.com',
      password: 'password123'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    if (registerResponse.status === 200) {
      userToken = registerResponse.body.token;
      expect(userToken).toBeDefined();
    }

    // Step 2: League Creation
    const leagueData = {
      name: 'Integration Test League',
      description: 'A league for integration testing'
    };

    const leagueResponse = await request(app)
      .post('/api/leagues')
      .set('Authorization', `Bearer ${userToken}`)
      .send(leagueData);

    if (leagueResponse.status === 200) {
      leagueId = leagueResponse.body.id;
      expect(leagueId).toBeDefined();
    }

    // Step 3: Add Players to League
    const playerData = {
      name: 'Test Player 1',
      emoji: '⚽'
    };

    const playerResponse = await request(app)
      .post(`/api/players/${leagueId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(playerData);

    if (playerResponse.status === 200) {
      playerId = playerResponse.body.id;
      expect(playerId).toBeDefined();
    }

    // Step 4: Submit Tier List (if players exist)
    if (playerId) {
      const tierListData = {
        playerOrder: [playerId]
      };

      const tierListResponse = await request(app)
        .post(`/api/tierlist/${leagueId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(tierListData);

      expect(tierListResponse.status).toBe(200);
    }

    // Step 5: Create Match (if league has enough data)
    const matchData = {
      leagueId: leagueId,
      date: new Date('2025-01-20T15:00:00Z'),
      lineupBudget: 100
    };

    const matchResponse = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${userToken}`)
      .send(matchData);

    if (matchResponse.status === 200) {
      matchId = matchResponse.body.id;
      expect(matchId).toBeDefined();

      // Step 6: Join Match
      const joinResponse = await request(app)
        .post(`/api/matches/${matchId}/join`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(joinResponse.status).toBe(200);
    }

    // Step 7: Test Rankings Endpoint
    const rankingsResponse = await request(app)
      .get(`/api/leagues/${leagueId}/rankings`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(rankingsResponse.status).toBe(200);

    // Verify the flow completed without critical errors
    expect(userToken).toBeDefined();
    expect(leagueId).toBeDefined();
  });

  it('should handle invalid data gracefully throughout the flow', async () => {
    // Test with invalid registration data
    const invalidUser = {
      username: '',
      email: 'invalid-email',
      password: '123'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidUser);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid input');
  });

  it('should protect endpoints correctly', async () => {
    // Test accessing protected endpoints without token
    const response = await request(app)
      .get('/api/leagues');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });
});