import { describe, test, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// Simple API test without database dependencies
describe('Simple API Tests', () => {
  test('should create basic express app', async () => {
    const app = express();
    app.use(express.json());
    
    // Simple test route
    app.get('/test', (req, res) => {
      res.json({ message: 'Test successful' });
    });

    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.body.message).toBe('Test successful');
  });

  test('should handle JSON body parsing', async () => {
    const app = express();
    app.use(express.json());
    
    app.post('/test', (req, res) => {
      res.json({ received: req.body });
    });

    const testData = { test: 'data' };
    const response = await request(app)
      .post('/test')
      .send(testData)
      .expect(200);

    expect(response.body.received).toEqual(testData);
  });
});