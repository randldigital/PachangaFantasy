import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';
import { DatabaseStorage } from '../../server/storage';

// Mock the storage
vi.mock('@server/storage', () => {
  const mockStorage = {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    authenticateUser: vi.fn(),
    getUser: vi.fn(),
  };
  return {
    DatabaseStorage: vi.fn(() => mockStorage),
    storage: mockStorage,
  };
});

describe('Authentication API', () => {
  let app: Express;
  let mockStorage: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    mockStorage = new DatabaseStorage();
    await registerRoutes(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user', async () => {
      const newUser = { username: 'user', email: 'user@example.com', password: 'pw12345' };
      const createdUser = { id: 1, username: 'user', email: 'user@example.com', role: 'player', leagueId: null };
      mockStorage.getUserByEmail.mockResolvedValue(null);
      mockStorage.createUser.mockResolvedValue(createdUser);
      const res = await request(app).post('/api/auth/register').send(newUser);
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(createdUser);
      expect(res.body.token).toBeDefined();
    });
    it('rejects duplicate email', async () => {
      mockStorage.getUserByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      const res = await request(app).post('/api/auth/register').send({ username: 'user', email: 'user@example.com', password: 'pw12345' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('User already exists');
    });
    it('validates required fields', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(null);
      mockStorage.createUser.mockRejectedValue(new Error('Validation failed'));
      const res = await request(app).post('/api/auth/register').send({ username: '', email: 'bad', password: '1' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid input');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const loginData = { email: 'user@example.com', password: 'pw12345' };
      const userWithToken = { user: { id: 1, username: 'user', email: 'user@example.com', role: 'player', leagueId: null }, token: 'mock-token' };
      mockStorage.authenticateUser.mockResolvedValue(userWithToken);
      const res = await request(app).post('/api/auth/login').send(loginData);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(userWithToken);
    });
    it('rejects invalid credentials', async () => {
      mockStorage.authenticateUser.mockResolvedValue(null);
      const res = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user info for valid token', async () => {
      const user = { id: 1, username: 'user', email: 'user@example.com', role: 'player', leagueId: null };
      mockStorage.getUser.mockResolvedValue(user);
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET || 'pachanga-secret-key');
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(user);
    });
    it('rejects missing token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Access token required');
    });
    it('rejects invalid token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer badtoken');
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Invalid token');
    });
  });
});