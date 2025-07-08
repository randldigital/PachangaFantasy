import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createMockUser, createMockLeague, createMockPlayer, createMockMatch } from '../test-utils';

// Mock API handlers
export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json() as any;
    
    if (email === 'test@example.com' && password === 'password') {
      return HttpResponse.json({
        user: createMockUser(),
        token: 'mock-jwt-token'
      });
    }
    
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const userData = await request.json() as any;
    return HttpResponse.json({
      user: createMockUser({ email: userData.email, username: userData.username }),
      token: 'mock-jwt-token'
    });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({ user: createMockUser() });
  }),

  // League endpoints
  http.get('/api/leagues', () => {
    return HttpResponse.json([
      createMockLeague(),
      createMockLeague({ id: 2, name: 'Second League', inviteCode: 'TEST456' })
    ]);
  }),

  http.post('/api/leagues', async ({ request }) => {
    const leagueData = await request.json() as any;
    return HttpResponse.json(createMockLeague(leagueData));
  }),

  http.get('/api/leagues/:id', ({ params }) => {
    const id = parseInt(params.id as string);
    return HttpResponse.json(createMockLeague({ id }));
  }),

  // Player endpoints
  http.get('/api/players/:leagueId', ({ params }) => {
    const leagueId = parseInt(params.leagueId as string);
    const players = Array.from({ length: 10 }, (_, i) => 
      createMockPlayer({ 
        id: i + 1, 
        name: `Player ${i + 1}`,
        leagueId,
        marketValue: 10 + (i * 5)
      })
    );
    return HttpResponse.json(players);
  }),

  http.post('/api/players/:leagueId', async ({ request, params }) => {
    const playerData = await request.json() as any;
    const leagueId = parseInt(params.leagueId as string);
    return HttpResponse.json(createMockPlayer({ ...playerData, leagueId }));
  }),

  // Match endpoints
  http.get('/api/leagues/:leagueId/matches', ({ params }) => {
    const leagueId = parseInt(params.leagueId as string);
    return HttpResponse.json([
      createMockMatch({ leagueId, status: 'open' }),
      createMockMatch({ id: 2, leagueId, status: 'completed', date: new Date('2025-01-10T10:00:00Z') })
    ]);
  }),

  http.post('/api/matches', async ({ request }) => {
    const matchData = await request.json() as any;
    return HttpResponse.json(createMockMatch(matchData));
  }),

  http.get('/api/matches/:id', ({ params }) => {
    const id = parseInt(params.id as string);
    return HttpResponse.json({
      ...createMockMatch({ id }),
      participants: []
    });
  }),

  // Tier list endpoints
  http.get('/api/tierlist/:leagueId', ({ params }) => {
    const leagueId = parseInt(params.leagueId as string);
    return HttpResponse.json([
      {
        id: 1,
        leagueId,
        userId: 1,
        playerOrder: [1, 2, 3, 4, 5],
        submitted: true
      }
    ]);
  }),

  http.post('/api/tierlist/:leagueId', async ({ request, params }) => {
    const tierListData = await request.json() as any;
    const leagueId = parseInt(params.leagueId as string);
    return HttpResponse.json({
      id: 1,
      leagueId,
      userId: 1,
      ...tierListData
    });
  }),

  // Rankings endpoint
  http.get('/api/leagues/:leagueId/rankings', ({ params }) => {
    const leagueId = parseInt(params.leagueId as string);
    return HttpResponse.json([
      { userId: 1, username: 'testuser', totalPoints: 25 },
      { userId: 2, username: 'player2', totalPoints: 18 },
      { userId: 3, username: 'player3', totalPoints: 12 }
    ]);
  }),
];

export const server = setupServer(...handlers);