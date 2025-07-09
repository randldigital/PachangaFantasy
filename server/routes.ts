import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { users, matchParticipants, insertUserSchema, insertLeagueSchema, insertPlayerSchema, insertTierListSchema, loginSchema, joinLeagueSchema, insertMatchSchema, insertLineupSchema, insertStatReportSchema, adminGoalValidationSchema, type User, type Match, type Lineup, type StatReport, type AdminGoalValidationInput } from "@shared/schema";

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
      
      console.log(`Creating league for user ${req.user!.username} (ID: ${req.user!.id})`);
      const league = await storage.createLeague(leagueData, req.user!.id);
      console.log(`League created: ${league.id}, now creating player record...`);
      
      // Automatically add the league creator as a player
      const creatorPlayer = await storage.createPlayer({
        name: req.user!.username,
        emoji: '👑', // Crown emoji for league creator
        leagueId: league.id,
        userId: req.user!.id,
        createdBy: req.user!.id
      });
      
      console.log('League created with creator as player:', { 
        league: league.id, 
        player: creatorPlayer.id, 
        creator: req.user!.username,
        playerUserId: creatorPlayer.userId 
      });
      
      res.json(league);
    } catch (error) {
      console.error('Create league error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ message: error.message });
      } else {
        res.status(400).json({ message: 'Invalid input' });
      }
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

      // Check if user already has a player record in this league
      const existingPlayer = await storage.checkUserAsPlayer(req.user!.id, league.id);
      
      // Add user to league participants
      const currentParticipants = league.participants || [];
      const updatedLeague = await storage.updateLeague(league.id, {
        participants: [...currentParticipants, req.user!.id]
      });

      // Create the user as a player in this league if they don't have one
      if (updatedLeague && !existingPlayer) {
        const userPlayer = await storage.createPlayer({
          name: req.user!.username,
          emoji: '👤',
          leagueId: league.id,
          userId: req.user!.id,
          createdBy: req.user!.id
        });

        console.log('User joined league and created as player:', { league: updatedLeague.id, player: userPlayer.id, username: req.user!.username });
        res.json({ league: updatedLeague, player: userPlayer });
      } else if (updatedLeague && existingPlayer) {
        console.log('User joined league with existing player record:', { league: updatedLeague.id, player: existingPlayer.id, username: req.user!.username });
        res.json({ league: updatedLeague, player: existingPlayer });
      } else {
        throw new Error('Failed to update league');
      }
    } catch (error) {
      console.error('Join league by invite code error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to join league' });
      }
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

      // Check if user already has a player record in this league
      const existingPlayer = await storage.checkUserAsPlayer(req.user!.id, leagueId);
      
      // Add user to league participants
      const currentParticipants = league.participants || [];
      const updatedLeague = await storage.updateLeague(league.id, {
        participants: [...currentParticipants, req.user!.id]
      });

      // Create the user as a player in this league if they don't have one
      if (updatedLeague && !existingPlayer) {
        const userPlayer = await storage.createPlayer({
          name: req.user!.username,
          emoji: '👤',
          leagueId: leagueId,
          userId: req.user!.id,
          createdBy: req.user!.id
        });

        console.log('User joined league and created as player:', { league: updatedLeague.id, player: userPlayer.id, username: req.user!.username });
        res.json({ league: updatedLeague, player: userPlayer });
      } else if (updatedLeague && existingPlayer) {
        console.log('User joined league with existing player record:', { league: updatedLeague.id, player: existingPlayer.id, username: req.user!.username });
        res.json({ league: updatedLeague, player: existingPlayer });
      } else {
        throw new Error('Failed to update league');
      }
    } catch (error) {
      console.error('Join league error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to join league' });
      }
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

  // Delete league (league creator only)
  app.delete('/api/leagues/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.id);
      const league = await storage.getLeague(leagueId);
      
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      // Only league creator can delete
      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can delete the league' });
      }

      await storage.deleteLeague(leagueId);
      console.log('League deleted:', { league: leagueId, creator: req.user!.username });
      res.json({ message: 'League deleted successfully' });
    } catch (error) {
      console.error('Delete league error:', error);
      res.status(500).json({ message: 'Failed to delete league' });
    }
  });

  // Player routes - League creators can add players to their leagues
  app.post('/api/players/:leagueId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { leagueId } = req.params;
      const league = await storage.getLeague(parseInt(leagueId));
      
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      // Only league creator/owner can add players (not admin role requirement)
      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can add players' });
      }

      const playerData = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer({ 
        ...playerData, 
        leagueId: parseInt(leagueId),
        createdBy: req.user!.id
      });
      
      console.log('League creator added player:', { league: leagueId, player: player.id, creator: req.user!.username });
      res.json(player);
    } catch (error) {
      console.error('Add player error:', error);
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

      console.log('Tier list request body:', req.body);
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
      console.error('Tier list validation error:', error);
      res.status(400).json({ message: 'Invalid input', error: error instanceof Error ? error.message : 'Unknown error' });
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

  // Add user as player in league (or repair existing player record)
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

      // Check if there's a player with the same name but missing userId (legacy data)
      const players = await storage.getPlayersByLeague(leagueId);
      const playerWithSameName = players.find(p => p.name === req.user!.username && !p.userId);
      
      if (playerWithSameName) {
        // Update existing player record to link to user
        const updatedPlayer = await storage.updatePlayer(playerWithSameName.id, { userId: req.user!.id });
        console.log('Repaired existing player record:', { league: leagueId, player: playerWithSameName.id, username: req.user!.username });
        return res.json(updatedPlayer);
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

  // v0.2 - Match Management Routes
  
  // Create a new match (league creator only)
  app.post('/api/matches', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Convert date string to Date object before validation
      const bodyWithDate = {
        ...req.body,
        date: new Date(req.body.date)
      };
      
      const result = insertMatchSchema.safeParse(bodyWithDate);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid input', errors: result.error.issues });
      }

      console.log(`Creating match for user ${req.user!.username} (ID: ${req.user!.id}) in league ${result.data.leagueId}`);

      // Check if user is the league creator
      const league = await storage.getLeague(result.data.leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can create matches' });
      }

      // Ensure creator has player record in this league (repair if missing)
      const creatorAsPlayer = await storage.checkUserAsPlayer(req.user!.id, result.data.leagueId);
      if (!creatorAsPlayer) {
        console.log(`Creator missing player record, creating one for league ${result.data.leagueId}`);
        await storage.createPlayer({
          name: req.user!.username,
          emoji: '👑',
          leagueId: result.data.leagueId,
          userId: req.user!.id,
          createdBy: req.user!.id
        });
        console.log(`Created missing player record for league creator`);
      }

      const matchData = {
        ...result.data,
        createdBy: req.user!.id
      };
      const match = await storage.createMatch(matchData);
      console.log('League creator created match:', { league: league.id, match: match.id, creator: req.user!.username });
      res.json(match);
    } catch (error) {
      console.error('Error creating match:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Get matches for a league
  app.get('/api/leagues/:leagueId/matches', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const matches = await storage.getMatchesByLeague(leagueId);
      res.json(matches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get match details
  app.get('/api/matches/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      const participants = await storage.getMatchParticipants(matchId);
      res.json({ ...match, participants });
    } catch (error) {
      console.error('Error fetching match:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete match (league creator only)
  app.delete('/api/matches/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      // Check if user is league creator
      const league = await storage.getLeague(match.leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can delete matches' });
      }

      await storage.deleteMatch(matchId);
      console.log('Match deleted:', { match: matchId, league: league.id, creator: req.user!.username });
      res.json({ message: 'Match deleted successfully' });
    } catch (error) {
      console.error('Delete match error:', error);
      res.status(500).json({ message: 'Failed to delete match' });
    }
  });

  // End match (league creator only)
  app.post('/api/matches/:id/end', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      // Check if user is league creator
      const league = await storage.getLeague(match.leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can end matches' });
      }

      // Update match status to completed
      const updatedMatch = await storage.updateMatch(matchId, { status: 'completed' });
      console.log('Match ended:', { match: matchId, league: league.id, creator: req.user!.username });
      res.json({ message: 'Match ended successfully. Participants can now submit stats.', match: updatedMatch });
    } catch (error) {
      console.error('End match error:', error);
      res.status(500).json({ message: 'Failed to end match' });
    }
  });

  // Get match participants with player details
  app.get('/api/matches/:id/participants', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const participants = await storage.getMatchParticipants(matchId);
      
      // Fetch player details for each participant
      const participantsWithDetails = await Promise.all(
        participants.map(async (participant) => {
          const player = await storage.getPlayer(participant.playerId);
          let user = null;
          
          // If player has a userId, fetch user details
          if (player?.userId) {
            user = await storage.getUser(player.userId);
          }
          
          return {
            matchId: participant.matchId,
            playerId: participant.playerId,
            status: participant.status,
            playerName: player?.name || 'Unknown Player',
            userId: player?.userId,
            username: user?.username,
            userRole: user?.role
          };
        })
      );

      res.json(participantsWithDetails);
    } catch (error) {
      console.error('Error fetching match participants:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin: Add players to a match
  app.post('/api/matches/:id/add-players', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const { playerIds } = req.body;
      
      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({ message: 'playerIds array is required' });
      }

      // Get match to verify it exists and get league info
      const match = await storage.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      // Get league to verify admin permission
      const league = await storage.getLeague(match.leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      // Check if user is league creator
      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can add players to matches' });
      }

      // Get existing participants to avoid duplicates
      const existingParticipants = await storage.getMatchParticipants(matchId);
      const existingPlayerIds = existingParticipants.map(p => p.playerId);

      // Get players from the league and filter out those already in match
      const playersToAdd = [];
      for (const playerId of playerIds) {
        const player = await storage.getPlayer(playerId);
        if (player && player.leagueId === match.leagueId && !existingPlayerIds.includes(playerId)) {
          playersToAdd.push(player);
        }
      }

      // Add players to match using their player IDs
      const newParticipants = [];
      for (const player of playersToAdd) {
        const participant = await storage.addPlayerToMatch(matchId, player.id);
        newParticipants.push(participant);
      }

      res.json({ 
        message: `${newParticipants.length} players added to match`,
        addedCount: newParticipants.length,
        participants: newParticipants 
      });
    } catch (error) {
      console.error('Error adding players to match:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Join a match
  app.post('/api/matches/:id/join', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.id);
      const userId = req.user!.id;

      console.log(`Join match attempt: matchId=${matchId}, userId=${userId}`);

      // Check if match exists
      const match = await storage.getMatch(matchId);
      if (!match) {
        console.log(`Match not found: ${matchId}`);
        return res.status(404).json({ message: 'Match not found' });
      }

      console.log(`Match found: leagueId=${match.leagueId}, status=${match.status}`);

      // Check if user is a player in this league
      const userAsPlayer = await storage.checkUserAsPlayer(userId, match.leagueId);
      console.log(`User as player check:`, userAsPlayer ? `player ID ${userAsPlayer.id}` : 'not found');
      
      if (!userAsPlayer) {
        return res.status(400).json({ 
          message: 'You must be added as a player in this league first',
          needsPlayerRecord: true
        });
      }

      console.log(`Calling storage.joinMatch with matchId=${matchId}, userId=${userId}`);
      const participant = await storage.joinMatch(matchId, userId);
      console.log(`Join match successful: participant playerId=${participant.playerId}, status=${participant.status}`);
      
      // Check if we have enough participants to balance teams (e.g., 10 players)
      console.log(`Getting participants for team balancing check...`);
      const participants = await storage.getMatchParticipants(matchId);
      const acceptedParticipants = participants.filter(p => p.status === 'accepted');
      console.log(`Participant count: ${acceptedParticipants.length} accepted participants`);
      
      if (acceptedParticipants.length >= 10) {
        console.log(`Balancing teams with ${acceptedParticipants.length} players...`);
        const playerIds = acceptedParticipants.map(p => p.playerId);
        const teams = await storage.balanceTeams(matchId, playerIds);
        await storage.updateMatch(matchId, { status: 'ready' });
        console.log(`Teams balanced and match status updated to 'ready'`);
      }

      res.json(participant);
    } catch (error) {
      console.error('Error joining match:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        if (error.message.includes('not a player')) {
          return res.status(400).json({ 
            message: 'You must be added as a player in this league first',
            needsPlayerRecord: true
          });
        }
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // v0.2 - Lineup Management Routes

  // Create/update lineup (any league member can create a lineup)
  app.post('/api/matches/:matchId/lineup', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const userId = req.user!.id;
      
      // Check if match exists and user has access to the league
      const match = await storage.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      const league = await storage.getLeague(match.leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      // Check if user is in the league (creator or participant)
      const hasAccess = league.createdBy === userId || 
                       (league.participants && league.participants.includes(userId));
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'You must be a member of this league to create a lineup' });
      }

      // Only allow lineup creation for open matches
      if (match.status !== 'open') {
        return res.status(400).json({ message: 'Can only create lineups for open matches' });
      }

      const result = insertLineupSchema.safeParse({
        ...req.body,
        matchId,
        userId
      });
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid input', errors: result.error.issues });
      }

      // Check if lineup already exists, update or create
      const existingLineup = await storage.getLineup(matchId, userId);
      
      if (existingLineup) {
        const updated = await storage.updateLineup(existingLineup.id, result.data);
        res.json(updated);
      } else {
        const lineup = await storage.createLineup(result.data);
        res.json(lineup);
      }
    } catch (error) {
      console.error('Error creating/updating lineup:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user's lineup for a match
  app.get('/api/matches/:matchId/lineup', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const userId = req.user!.id;
      
      const lineup = await storage.getLineup(matchId, userId);
      res.json(lineup || null);
    } catch (error) {
      console.error('Error fetching lineup:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // v0.2 - Stats & Scoring Routes

  // Submit stat report
  app.post('/api/matches/:matchId/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const userId = req.user!.id;

      const result = insertStatReportSchema.safeParse({
        ...req.body,
        matchId,
        userId
      });

      if (!result.success) {
        return res.status(400).json({ message: 'Invalid input', errors: result.error.issues });
      }

      const statReport = await storage.createStatReport(result.data);
      res.json(statReport);
    } catch (error) {
      console.error('Error creating stat report:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get stat reports for a match
  app.get('/api/matches/:matchId/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const statReports = await storage.getStatReportsForMatch(matchId);
      res.json(statReports);
    } catch (error) {
      console.error('Error fetching stat reports:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // League creator goal validation
  app.post('/api/matches/:matchId/validate-goals', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      
      // Check if user is league creator
      const match = await storage.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      const league = await storage.getLeague(match.leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      if (league.createdBy !== req.user!.id) {
        return res.status(403).json({ message: 'Only league creator can validate goals' });
      }
      
      const result = adminGoalValidationSchema.safeParse({
        ...req.body,
        matchId
      });
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid input', errors: result.error.issues });
      }

      const validation = await storage.validateMatchGoals(matchId, result.data.finalScore);
      console.log('League creator validated goals:', { league: league.id, match: matchId, creator: req.user!.username });
      res.json(validation);
    } catch (error) {
      console.error('Error validating match goals:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Calculate match scores (after verification complete)
  app.post('/api/matches/:matchId/calculate-scores', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parseInt(req.params.matchId);
      
      const scores = await storage.calculateMatchScores(matchId);
      await storage.updateMatch(matchId, { status: 'completed' });
      
      res.json(scores);
    } catch (error) {
      console.error('Error calculating match scores:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get league rankings
  app.get('/api/leagues/:leagueId/rankings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const rankings = await storage.getLeagueRankings(leagueId);
      res.json(rankings);
    } catch (error) {
      console.error('Error fetching league rankings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
