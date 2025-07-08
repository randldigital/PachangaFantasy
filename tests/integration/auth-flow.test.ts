import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '@server/routes';

// This is a comprehensive integration test that tests the full auth flow
describe('Authentication Flow Integration', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it('should complete full registration and login flow', async () => {
    const userData = {
      username: 'integrationuser',
      email: 'integration@test.com',
      password: 'password123'
    };

    // Step 1: Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(200);

    expect(registerResponse.body.user).toBeDefined();
    expect(registerResponse.body.token).toBeDefined();
    expect(registerResponse.body.user.email).toBe(userData.email);

    // Step 2: Login with credentials
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(200);

    expect(loginResponse.body.user).toBeDefined();
    expect(loginResponse.body.token).toBeDefined();

    // Step 3: Use token to access protected route
    const token = loginResponse.body.token;
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meResponse.body.user.email).toBe(userData.email);
  });

  it('should handle invalid credentials gracefully', async () => {
    // Try to login with non-existent user
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'wrongpassword'
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });
});