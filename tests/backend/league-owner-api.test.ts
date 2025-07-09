import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../server/index';
import { storage } from '../../server/storage';
import { createMockUser, createMockLeague, createMockMatch, createMockPlayer } from '../mocks/mockData';

// Mock the storage
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
    createPlayer: vi.fn(),
    getLeague: vi.fn(),
    deleteLeague: vi.fn(),
    getMatch: vi.fn(),
    updateMatch: vi.fn(),
  },
}));

describe('League Owner API Routes', () => {
  const mockUser = createMockUser({ id: 1, role: 'player' });
  const mockLeague = createMockLeague({ id: 1, createdBy: 1 });
  const mockMatch = createMockMatch({ id: 1, leagueId: 1 });
  
  let userToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    userToken = jwt.sign(
      { userId: mockUser.id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
    
    vi.mocked(storage.getUser).mockResolvedValue(mockUser);
  });

  describe('POST /api/players/:leagueId - Add Player', () => {
    it('should allow league creator to add player', async () => {
      vi.mocked(storage.getLeague).mockResolvedValue(mockLeague);
      vi.mocked(storage.createPlayer).mockResolvedValue(createMockPlayer({ id: 1, name: 'Test Player' }));

      const playerData = {
        name: 'Test Player',
        emoji: '⚽',
      };

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send(playerData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Player');
      expect(storage.createPlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Player',
          emoji: '⚽',
          leagueId: 1,
          createdBy: 1,
        })
      );
    });

    it('should reject non-league creator', async () => {
      const nonCreatorLeague = createMockLeague({ id: 1, createdBy: 2 });
      vi.mocked(storage.getLeague).mockResolvedValue(nonCreatorLeague);

      const playerData = {
        name: 'Test Player',
        emoji: '⚽',
      };

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send(playerData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should validate required fields', async () => {
      vi.mocked(storage.getLeague).mockResolvedValue(mockLeague);

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle non-existent league', async () => {
      vi.mocked(storage.getLeague).mockResolvedValue(undefined);

      const playerData = {
        name: 'Test Player',
        emoji: '⚽',
      };

      const response = await request(app)
        .post('/api/players/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send(playerData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });
  });

  describe('DELETE /api/leagues/:id - Delete League', () => {
    it('should allow league creator to delete league', async () => {
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
      const nonCreatorLeague = createMockLeague({ id: 1, createdBy: 2 });
      vi.mocked(storage.getLeague).mockResolvedValue(nonCreatorLeague);

      const response = await request(app)
        .delete('/api/leagues/1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should handle non-existent league', async () => {
      vi.mocked(storage.getLeague).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/leagues/1')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });
  });

  describe('POST /api/matches/:id/end - End Match', () => {
    it('should allow league creator to end match', async () => {
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
      const nonCreatorLeague = createMockLeague({ id: 1, createdBy: 2 });
      vi.mocked(storage.getMatch).mockResolvedValue(mockMatch);
      vi.mocked(storage.getLeague).mockResolvedValue(nonCreatorLeague);

      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only league creator');
    });

    it('should handle non-existent match', async () => {
      vi.mocked(storage.getMatch).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Match not found');
    });

    it('should handle non-existent league', async () => {
      vi.mocked(storage.getMatch).mockResolvedValue(mockMatch);
      vi.mocked(storage.getLeague).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/matches/1/end')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('League not found');
    });
  });
});