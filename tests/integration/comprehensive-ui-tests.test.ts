import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../server/index';
import { storage } from '../../server/storage';
import { createMockUser, createMockLeague, createMockMatch, createMockPlayer } from '../mocks/mockData';

// Mock the storage to prevent actual database calls
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
    getLeague: vi.fn(),
    getMatch: vi.fn(),
    createPlayer: vi.fn(),
    updateMatch: vi.fn(),
    deleteLeague: vi.fn(),
    getMatchesByLeague: vi.fn(),
    getMatchParticipants: vi.fn(),
    joinMatch: vi.fn(),
  },
}));

describe('Comprehensive UI Button Tests', () => {
  let userToken: string;
  let adminToken: string;
  
  const mockUser = createMockUser({ id: 1, role: 'player' });
  const mockAdmin = createMockUser({ id: 2, role: 'admin' });
  const mockLeague = createMockLeague({ id: 1, createdBy: 1 });
  const mockMatch = createMockMatch({ id: 1, leagueId: 1, status: 'open' });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Generate tokens
    userToken = jwt.sign(
      { userId: mockUser.id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
    
    adminToken = jwt.sign(
      { userId: mockAdmin.id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
  });

  describe('Add Player Form Tests', () => {
    it('should add player successfully for league creator', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getLeague).mockResolvedValue(mockLeague);
      vi.mocked(storage.createPlayer).mockResolvedValue(
        createMockPlayer({ id: 1, name: 'New Player', emoji: '⚽' })
      );

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Player',
          emoji: '⚽',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Player');
      expect(response.body.emoji).toBe('⚽');
    });

    it('should reject empty player name', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getLeague).mockResolvedValue(mockLeague);

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: '',
          emoji: '⚽',
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-league creator', async () => {
      const nonCreatorLeague = createMockLeague({ id: 1, createdBy: 99 });
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getLeague).mockResolvedValue(nonCreatorLeague);

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Player',
          emoji: '⚽',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });
  });

  describe('End Match Button Tests', () => {
    it('should end match successfully for league creator', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getMatch).mockResolvedValue(mockMatch);
      vi.mocked(storage.getLeague).mockResolvedValue(mockLeague);
      vi.mocked(storage.updateMatch).mockResolvedValue(
        createMockMatch({ id: 1, status: 'completed' })
      );

      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Match ended successfully');
      expect(storage.updateMatch).toHaveBeenCalledWith(1, { status: 'completed' });
    });

    it('should reject non-league creator', async () => {
      const nonCreatorLeague = createMockLeague({ id: 1, createdBy: 99 });
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getMatch).mockResolvedValue(mockMatch);
      vi.mocked(storage.getLeague).mockResolvedValue(nonCreatorLeague);

      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should handle non-existent match', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getMatch).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/matches/999/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Match not found');
    });
  });

  describe('Delete League Button Tests', () => {
    it('should delete league successfully for league creator', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getLeague).mockResolvedValue(mockLeague);
      vi.mocked(storage.deleteLeague).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/leagues/1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('League deleted successfully');
      expect(storage.deleteLeague).toHaveBeenCalledWith(1);
    });

    it('should reject non-league creator', async () => {
      const nonCreatorLeague = createMockLeague({ id: 1, createdBy: 99 });
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getLeague).mockResolvedValue(nonCreatorLeague);

      const response = await request(app)
        .delete('/api/leagues/1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should handle non-existent league', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getLeague).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/leagues/999')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });
  });

  describe('Match Management Tests', () => {
    it('should join match successfully', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getMatch).mockResolvedValue(mockMatch);
      vi.mocked(storage.joinMatch).mockResolvedValue({
        matchId: 1,
        playerId: 1,
        status: 'joined',
      });

      const response = await request(app)
        .post('/api/matches/1/join')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(storage.joinMatch).toHaveBeenCalledWith(1, 1);
    });

    it('should get match participants', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getMatchParticipants).mockResolvedValue([
        { matchId: 1, playerId: 1, status: 'joined' },
      ]);

      const response = await request(app)
        .get('/api/matches/1/participants')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get matches for league', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.getMatchesByLeague).mockResolvedValue([mockMatch]);

      const response = await request(app)
        .get('/api/leagues/1/matches')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle missing authentication token', async () => {
      const response = await request(app)
        .post('/api/matches/1/end');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    it('should handle invalid authentication token', async () => {
      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(storage.getUser).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(500);
    });
  });
});