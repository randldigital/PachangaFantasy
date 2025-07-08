import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { insertUserSchema, insertLeagueSchema, insertPlayerSchema, insertTierListSchema, loginSchema, joinLeagueSchema, type User } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "pachanga-secret-key";

interface AuthRequest extends Request {
  user?: User;
}

// Middleware to verify JWT
const authenticateToken = async (req: AuthRequest, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email?: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Middleware to check admin role
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      
      res.json({ user: { ...user, password: undefined }, token });
    } catch (error) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const result = await storage.authenticateUser(email, password);
      if (!result) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      res.json({ user: { ...result.user, password: undefined }, token: result.token });
    } catch (error) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    res.json({ user: { ...req.user!, password: undefined } });
  });

  // League routes
  app.post('/api/leagues', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueData = insertLeagueSchema.parse(req.body);
      const league = await storage.createLeague(leagueData, req.user!.id);
      
      // Note: User role management can be handled differently in production
      
      res.json(league);
    } catch (error) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.post('/api/leagues/:inviteCode/join', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { inviteCode } = req.params;
      const league = await storage.getLeagueByInviteCode(inviteCode);
      
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      if (league.participants && league.participants.includes(req.user!.id)) {
        return res.status(400).json({ message: 'Already in league' });
      }

      // Add user to league participants
      const currentParticipants = league.participants || [];
      const updatedLeague = await storage.updateLeague(league.id, {
        participants: [...currentParticipants, req.user!.id]
      });

      // Create the user as a player in this league
      if (updatedLeague) {
        const userPlayer = await storage.createPlayer({
          name: req.user!.username,
          emoji: '👤',
          leagueId: league.id
        });

        console.log('User joined league and created as player:', { league: updatedLeague.id, player: userPlayer.id, username: req.user!.username });
        res.json(updatedLeague);
      } else {
        throw new Error('Failed to update league');
      }
    } catch (error) {
      console.error('Join league by invite code error:', error);
      res.status(500).json({ message: 'Failed to join league' });
    }
  });

  // Direct join league by ID endpoint for participants
  app.post('/api/leagues/:id/join', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.id);
      const league = await storage.getLeague(leagueId);
      
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      if (league.participants && league.participants.includes(req.user!.id)) {
        return res.status(400).json({ message: 'Already in league' });
      }

      // Add user to league participants
      const currentParticipants = league.participants || [];
      const updatedLeague = await storage.updateLeague(league.id, {
        participants: [...currentParticipants, req.user!.id]
      });

      // Also create the user as a player in this league
      if (updatedLeague) {
        const userPlayer = await storage.createPlayer({
          name: req.user!.username,
          emoji: '👤', // Default user emoji
          leagueId: leagueId
        });

        console.log('User joined league and created as player:', { league: updatedLeague.id, player: userPlayer.id, username: req.user!.username });
        res.json({ league: updatedLeague, player: userPlayer });
      } else {
        throw new Error('Failed to update league');
      }
    } catch (error) {
      console.error('Join league error:', error);
      res.status(500).json({ message: 'Failed to join league' });
    }
  });

  app.get('/api/leagues', authenticateToken, async (req: AuthRequest, res: Response) => {
    const leagues = await storage.getUserLeagues(req.user!.id);
    res.json(leagues);
  });

  app.get('/api/leagues/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const league = await storage.getLeague(parseInt(id));
    
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }

    // Check if user has access to this league (is creator or participant)
    const hasAccess = league.createdBy === req.user!.id || 
                     (league.participants && league.participants.includes(req.user!.id));
    
    if (!hasAccess) {
      return res.status(404).json({ message: 'League not found' });
    }

    res.json(league);
  });

  // Player routes
  app.post('/api/players/:leagueId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(parseInt(leagueId));
      
      if (!league || league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const playerData = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer({ ...playerData, leagueId: parseInt(leagueId) });
      
      res.json(player);
    } catch (error) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.get('/api/players/:leagueId', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { leagueId } = req.params;
    const league = await storage.getLeague(parseInt(leagueId));
    
    if (!league || !league.participants || !league.participants.includes(req.user!.id)) {
      return res.status(404).json({ message: 'League not found' });
    }

    const players = await storage.getPlayersByLeague(parseInt(leagueId));
    res.json(players);
  });

  // Tier list routes
  app.post('/api/tierlist/:leagueId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(parseInt(leagueId));
      
      if (!league || !league.participants || !league.participants.includes(req.user!.id)) {
        return res.status(404).json({ message: 'League not found' });
      }

      const tierListData = insertTierListSchema.parse(req.body);
      
      // Check if user already submitted
      const existing = await storage.getTierList(parseInt(leagueId), req.user!.id);
      if (existing) {
        // For Replit DB, we need to use the custom update method
        if ('updateTierListByLeagueAndUser' in storage) {
          const updated = await (storage as any).updateTierListByLeagueAndUser(parseInt(leagueId), req.user!.id, {
            playerOrder: Array.isArray(tierListData.playerOrder) ? tierListData.playerOrder as number[] : []
          });
          return res.json(updated);
        } else {
          // Fallback for memory storage
          const updated = await storage.updateTierList(existing.id, {
            playerOrder: Array.isArray(tierListData.playerOrder) ? tierListData.playerOrder as number[] : []
          });
          return res.json(updated);
        }
      }

      const tierList = await storage.createTierList({
        ...tierListData,
        leagueId: parseInt(leagueId),
        userId: req.user!.id
      });
      
      res.json(tierList);
    } catch (error) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.get('/api/tierlist/:leagueId', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { leagueId } = req.params;
    const league = await storage.getLeague(parseInt(leagueId));
    
    if (!league || !league.participants || !league.participants.includes(req.user!.id)) {
      return res.status(404).json({ message: 'League not found' });
    }

    const tierList = await storage.getTierList(parseInt(leagueId), req.user!.id);
    res.json(tierList || null);
  });

  app.post('/api/tierlist/:leagueId/close', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(parseInt(leagueId));
      
      if (!league || league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Get all tier lists for this league
      const tierLists = await storage.getTierListsByLeague(parseInt(leagueId));
      const players = await storage.getPlayersByLeague(parseInt(leagueId));
      
      // Calculate market values
      const playerValues = new Map<number, number[]>();
      
      tierLists.forEach(tierList => {
        tierList.playerOrder.forEach((playerId, index) => {
          if (!playerValues.has(playerId)) {
            playerValues.set(playerId, []);
          }
          playerValues.get(playerId)!.push(index + 1); // 1-based position
        });
      });

      // Calculate average position removing outliers
      playerValues.forEach(async (positions, playerId) => {
        if (positions.length > 2) {
          // Remove highest and lowest
          positions.sort((a, b) => a - b);
          positions = positions.slice(1, -1);
        }
        
        const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
        
        // Convert position to market value (lower position = higher value)
        const maxValue = 120; // millions
        const minValue = 10;
        const marketValue = Math.round(maxValue - ((avgPosition - 1) / (players.length - 1)) * (maxValue - minValue));
        
        await storage.updatePlayer(playerId, { marketValue });
      });

      // Update league status
      await storage.updateLeague(parseInt(leagueId), { status: 'closed' });
      
      res.json({ message: 'League closed and values calculated' });
    } catch (error) {
      res.status(400).json({ message: 'Error closing league' });
    }
  });

  // Add user as player in league
  app.post('/api/leagues/:leagueId/add-me-as-player', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const league = await storage.getLeague(leagueId);
      
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      // Check if user is a participant in the league
      if (!league.participants.includes(req.user!.id)) {
        return res.status(403).json({ message: 'You must be a participant in this league' });
      }

      // Check if user is already a player in this league
      const existingPlayer = await storage.checkUserAsPlayer(req.user!.id, leagueId);
      if (existingPlayer) {
        return res.status(400).json({ message: 'You are already a player in this league', player: existingPlayer });
      }

      // Create user as player
      const userPlayer = await storage.createPlayer({
        name: req.user!.username,
        emoji: '👤',
        leagueId: leagueId,
        createdBy: req.user!.id,
        userId: req.user!.id
      });

      console.log('User added themselves as player:', { league: leagueId, player: userPlayer.id, username: req.user!.username });
      res.json(userPlayer);
    } catch (error) {
      console.error('Add user as player error:', error);
      res.status(500).json({ message: 'Failed to add user as player' });
    }
  });

  // Check if user is already a player in league
  app.get('/api/leagues/:leagueId/check-user-player', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const existingPlayer = await storage.checkUserAsPlayer(req.user!.id, leagueId);
      
      res.json({ isPlayer: !!existingPlayer, player: existingPlayer || null });
    } catch (error) {
      res.status(500).json({ message: 'Failed to check user player status' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
