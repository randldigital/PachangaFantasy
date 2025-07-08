import type { IStorage } from './storage';
import type { User, League, Player, TierList, InsertUser, InsertLeague, InsertPlayer, InsertTierList } from '@shared/schema';
import * as db from './db';

/**
 * Replit DB implementation of the storage interface
 * This provides a persistent, scalable database layer using Replit's key-value store
 */
export class ReplitStorage implements IStorage {
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const user = await db.getUserById(id);
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await db.getUserByEmail(email);
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await db.getUserByUsername(username);
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    return await db.createUser(userData);
  }

  async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    return await db.authenticateUser(email, password);
  }

  // League methods
  async getLeague(id: number): Promise<League | undefined> {
    const league = await db.getLeagueById(id);
    return league || undefined;
  }

  async getLeagueByInviteCode(inviteCode: string): Promise<League | undefined> {
    const league = await db.getLeagueByInviteCode(inviteCode);
    return league || undefined;
  }

  async createLeague(leagueData: InsertLeague, createdBy: number): Promise<League> {
    return await db.createLeague(leagueData, createdBy);
  }

  async updateLeague(id: number, updates: Partial<League>): Promise<League | undefined> {
    const updated = await db.updateLeague(id, updates);
    return updated || undefined;
  }

  async getUserLeagues(userId: number): Promise<League[]> {
    return await db.getUserLeagues(userId);
  }

  // Player methods
  async getPlayer(id: number): Promise<Player | undefined> {
    const player = await db.getPlayerById(id);
    return player || undefined;
  }

  async getPlayersByLeague(leagueId: number): Promise<Player[]> {
    return await db.getPlayersByLeague(leagueId);
  }

  async createPlayer(playerData: InsertPlayer & { leagueId: number }): Promise<Player> {
    return await db.createPlayer(playerData);
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const updated = await db.updatePlayer(id, updates);
    return updated || undefined;
  }

  // Tier list methods
  async getTierList(leagueId: number, userId: number): Promise<TierList | undefined> {
    const tierList = await db.getTierList(leagueId, userId);
    return tierList || undefined;
  }

  async getTierListsByLeague(leagueId: number): Promise<TierList[]> {
    return await db.getTierListsByLeague(leagueId);
  }

  async createTierList(tierListData: InsertTierList & { leagueId: number; userId: number }): Promise<TierList> {
    return await db.submitTierList(tierListData);
  }

  async updateTierList(id: number, updates: Partial<TierList>): Promise<TierList | undefined> {
    // For Replit DB, we need leagueId and userId to update a tier list
    // We'll need to modify this method signature or find another approach
    // For now, let's throw an error to indicate this needs refactoring
    throw new Error('updateTierList with only ID is not supported in Replit DB. Use updateTierListByLeagueAndUser instead.');
  }

  // Additional helper method specific to Replit DB implementation
  async updateTierListByLeagueAndUser(leagueId: number, userId: number, updates: Partial<TierList>): Promise<TierList | undefined> {
    const updated = await db.updateTierList(leagueId, userId, updates);
    return updated || undefined;
  }

  // Database utility methods
  async calculatePlayerMarketValues(leagueId: number): Promise<void> {
    await db.calculatePlayerValues(leagueId);
  }

  async getDatabaseStats(): Promise<{ users: number; leagues: number; players: number; tierLists: number }> {
    return await db.getDatabaseStats();
  }

  async clearDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      await db.clearDatabase();
    } else {
      throw new Error('Database clearing is only allowed in development environment');
    }
  }
}

// Export a singleton instance
export const replitStorage = new ReplitStorage();