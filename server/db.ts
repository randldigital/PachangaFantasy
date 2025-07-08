import Database from '@replit/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import type { User, League, Player, TierList, InsertUser, InsertLeague, InsertPlayer, InsertTierList } from '@shared/schema';

const db = new Database();
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

// Helper functions for key generation
const getUserKey = (userId: string | number) => `user:${userId}`;
const getLeagueKey = (leagueId: string | number) => `league:${leagueId}`;
const getPlayerKey = (playerId: string | number) => `player:${playerId}`;
const getTierListKey = (leagueId: string | number, userId: string | number) => `tierlist:${leagueId}:${userId}`;
const getEmailIndexKey = (email: string) => `email_index:${email}`;
const getUsernameIndexKey = (username: string) => `username_index:${username}`;
const getInviteCodeIndexKey = (inviteCode: string) => `invite_index:${inviteCode}`;

// Helper functions for listing by prefix
const listByPrefix = async (prefix: string): Promise<string[]> => {
  try {
    const keys = await db.list(prefix);
    return Array.isArray(keys) ? keys : [];
  } catch (error) {
    console.error(`Error listing keys with prefix ${prefix}:`, error);
    return [];
  }
};

const getValuesByPrefix = async <T>(prefix: string): Promise<T[]> => {
  const keys = await listByPrefix(prefix);
  const values: T[] = [];
  
  for (const key of keys) {
    try {
      const value = await db.get(key);
      if (value) {
        values.push(value);
      }
    } catch (error) {
      console.error(`Error getting value for key ${key}:`, error);
    }
  }
  
  return values;
};

// User management functions
export const createUser = async (userData: InsertUser): Promise<User> => {
  const userId = nanoid();
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  const user: User = {
    id: parseInt(userId, 36), // Convert to number for compatibility
    email: userData.email,
    username: userData.username,
    password: hashedPassword,
    role: userData.role || 'player',
    leagueId: null,
  };
  
  // Store user data
  await db.set(getUserKey(user.id), user);
  
  // Create indexes for fast lookup
  await db.set(getEmailIndexKey(user.email), user.id);
  await db.set(getUsernameIndexKey(user.username), user.id);
  
  return user;
};

export const getUserById = async (userId: number): Promise<User | null> => {
  const user = await db.get(getUserKey(userId));
  return user || null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const userId = await db.get(getEmailIndexKey(email));
  if (!userId) return null;
  
  return getUserById(userId);
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const userId = await db.get(getUsernameIndexKey(username));
  if (!userId) return null;
  
  return getUserById(userId);
};

export const authenticateUser = async (email: string, password: string): Promise<{ user: User; token: string } | null> => {
  const user = await getUserByEmail(email);
  if (!user) return null;
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) return null;
  
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
  return { user, token };
};

export const getUsersByLeagueId = async (leagueId: number): Promise<User[]> => {
  const users = await getValuesByPrefix<User>('user:');
  return users.filter(user => user.leagueId === leagueId);
};

// League management functions
export const createLeague = async (leagueData: InsertLeague, adminId: number): Promise<League> => {
  const leagueId = nanoid();
  const inviteCode = nanoid(6).toUpperCase();
  
  const league: League = {
    id: parseInt(leagueId, 36), // Convert to number for compatibility
    name: leagueData.name,
    description: leagueData.description || '',
    inviteCode,
    createdBy: adminId,
    participants: [adminId],
    status: 'open',
    createdAt: new Date(),
  };
  
  // Store league data
  await db.set(getLeagueKey(league.id), league);
  
  // Create invite code index
  await db.set(getInviteCodeIndexKey(inviteCode), league.id);
  
  // Update user's leagueId
  const user = await getUserById(adminId);
  if (user) {
    user.leagueId = league.id;
    await db.set(getUserKey(adminId), user);
  }
  
  return league;
};

export const getLeagueById = async (leagueId: number): Promise<League | null> => {
  const league = await db.get(getLeagueKey(leagueId));
  return league || null;
};

export const getLeagueByInviteCode = async (inviteCode: string): Promise<League | null> => {
  const leagueId = await db.get(getInviteCodeIndexKey(inviteCode));
  if (!leagueId) return null;
  
  return getLeagueById(leagueId);
};

export const joinLeague = async (inviteCode: string, userId: number): Promise<League | null> => {
  const league = await getLeagueByInviteCode(inviteCode);
  if (!league || league.status !== 'open') return null;
  
  // Check if user is already in the league
  if (league.participants.includes(userId)) return league;
  
  // Add user to league participants
  league.participants.push(userId);
  await db.set(getLeagueKey(league.id), league);
  
  // Update user's leagueId
  const user = await getUserById(userId);
  if (user) {
    user.leagueId = league.id;
    await db.set(getUserKey(userId), user);
  }
  
  return league;
};

export const getUserLeagues = async (userId: number): Promise<League[]> => {
  const leagues = await getValuesByPrefix<League>('league:');
  return leagues.filter(league => league.participants.includes(userId));
};

export const updateLeague = async (leagueId: number, updates: Partial<League>): Promise<League | null> => {
  const league = await getLeagueById(leagueId);
  if (!league) return null;
  
  const updatedLeague = { ...league, ...updates };
  await db.set(getLeagueKey(leagueId), updatedLeague);
  
  return updatedLeague;
};

// Player management functions
export const createPlayer = async (playerData: InsertPlayer & { leagueId: number }): Promise<Player> => {
  const playerId = nanoid();
  
  const player: Player = {
    id: parseInt(playerId, 36), // Convert to number for compatibility
    name: playerData.name,
    position: playerData.position,
    team: playerData.team || '',
    leagueId: playerData.leagueId,
    marketValue: 0,
  };
  
  await db.set(getPlayerKey(player.id), player);
  return player;
};

export const getPlayerById = async (playerId: number): Promise<Player | null> => {
  const player = await db.get(getPlayerKey(playerId));
  return player || null;
};

export const getPlayersByLeague = async (leagueId: number): Promise<Player[]> => {
  const players = await getValuesByPrefix<Player>('player:');
  return players.filter(player => player.leagueId === leagueId);
};

export const updatePlayer = async (playerId: number, updates: Partial<Player>): Promise<Player | null> => {
  const player = await getPlayerById(playerId);
  if (!player) return null;
  
  const updatedPlayer = { ...player, ...updates };
  await db.set(getPlayerKey(playerId), updatedPlayer);
  
  return updatedPlayer;
};

// Tier list management functions
export const submitTierList = async (tierListData: InsertTierList & { leagueId: number; userId: number }): Promise<TierList> => {
  const tierList: TierList = {
    id: parseInt(nanoid(), 36), // Convert to number for compatibility
    leagueId: tierListData.leagueId,
    userId: tierListData.userId,
    playerOrder: tierListData.playerOrder,
    submitted: true,
  };
  
  await db.set(getTierListKey(tierList.leagueId, tierList.userId), tierList);
  return tierList;
};

export const getTierList = async (leagueId: number, userId: number): Promise<TierList | null> => {
  const tierList = await db.get(getTierListKey(leagueId, userId));
  return tierList || null;
};

export const getTierListsByLeague = async (leagueId: number): Promise<TierList[]> => {
  const tierLists = await getValuesByPrefix<TierList>(`tierlist:${leagueId}:`);
  return tierLists;
};

export const updateTierList = async (leagueId: number, userId: number, updates: Partial<TierList>): Promise<TierList | null> => {
  const tierList = await getTierList(leagueId, userId);
  if (!tierList) return null;
  
  const updatedTierList = { ...tierList, ...updates };
  await db.set(getTierListKey(leagueId, userId), updatedTierList);
  
  return updatedTierList;
};

// Market value calculation
export const calculatePlayerValues = async (leagueId: number): Promise<void> => {
  const tierLists = await getTierListsByLeague(leagueId);
  const players = await getPlayersByLeague(leagueId);
  
  if (tierLists.length === 0) return;
  
  // Calculate average position for each player
  const playerPositions: { [playerId: number]: number[] } = {};
  
  tierLists.forEach(tierList => {
    tierList.playerOrder.forEach((playerId, index) => {
      if (!playerPositions[playerId]) {
        playerPositions[playerId] = [];
      }
      playerPositions[playerId].push(index + 1); // Position is 1-indexed
    });
  });
  
  // Calculate market values based on average position (excluding outliers)
  for (const player of players) {
    const positions = playerPositions[player.id] || [];
    
    if (positions.length > 0) {
      // Remove highest and lowest positions if we have more than 2 submissions
      let finalPositions = positions;
      if (positions.length > 2) {
        const sorted = [...positions].sort((a, b) => a - b);
        finalPositions = sorted.slice(1, -1); // Remove first (lowest) and last (highest)
      }
      
      const averagePosition = finalPositions.reduce((sum, pos) => sum + pos, 0) / finalPositions.length;
      
      // Convert average position to market value (lower position = higher value)
      // Base value of 100, decreased by average position
      const marketValue = Math.max(10, 100 - (averagePosition - 1) * 5);
      
      await updatePlayer(player.id, { marketValue: Math.round(marketValue) });
    }
  }
};

// Database utilities
export const clearDatabase = async (): Promise<void> => {
  // Only use in development/testing
  if (process.env.NODE_ENV === 'development') {
    const keys = await db.list();
    for (const key of keys) {
      await db.delete(key);
    }
  }
};

export const getDatabaseStats = async (): Promise<{ users: number; leagues: number; players: number; tierLists: number }> => {
  const [users, leagues, players, tierLists] = await Promise.all([
    getValuesByPrefix<User>('user:'),
    getValuesByPrefix<League>('league:'),
    getValuesByPrefix<Player>('player:'),
    getValuesByPrefix<TierList>('tierlist:'),
  ]);
  
  return {
    users: users.length,
    leagues: leagues.length,
    players: players.length,
    tierLists: tierLists.length,
  };
};

export default db;