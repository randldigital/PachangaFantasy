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
  };
  
  return {
    DatabaseStorage: vi.fn(() => mockStorage),
    storage: mockStorage,
  };
});

describe('Authentication Routes', () => {
  let app: express.Application;
  let mockStorage: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Get the mocked storage instance
    mockStorage = new DatabaseStorage();
    
    // Register routes
    await registerRoutes(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const createdUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'player',
        leagueId: null
      };

      mockStorage.getUserByEmail.mockResolvedValue(null);
      mockStorage.createUser.mockResolvedValue(createdUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(createdUser);
      expect(response.body.token).toBeDefined();
      expect(mockStorage.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: newUser.username,
          email: newUser.email,
          hashedPassword: expect.any(String)
        })
      );
    });

    it('should return error if user already exists', async () => {
      const existingUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockStorage.getUserByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(existingUser);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User already exists');
    });

    it('should validate required fields', async () => {
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
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const userWithToken = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'player',
          leagueId: null
        },
        token: 'mock-jwt-token'
      };

      mockStorage.authenticateUser.mockResolvedValue(userWithToken);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(userWithToken);
      expect(mockStorage.authenticateUser).toHaveBeenCalledWith(
        loginData.email,
        loginData.password
      );
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockStorage.authenticateUser.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info for valid token', async () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'player',
        leagueId: null
      };

      mockStorage.getUser.mockResolvedValue(user);

      // Create a valid JWT token for testing
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET || 'pachanga-secret-key');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(user);
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });
  });
});