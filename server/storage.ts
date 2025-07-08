import { users, leagues, players, tierLists, type User, type InsertUser, type League, type InsertLeague, type Player, type InsertPlayer, type TierList, type InsertTierList } from "@shared/schema";
import { db } from "./db";
import { eq, and, arrayContains, or, sql } from "drizzle-orm";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

// Storage interface
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null>;
  
  // Leagues
  getLeague(id: number): Promise<League | undefined>;
  getLeagueByInviteCode(inviteCode: string): Promise<League | undefined>;
  createLeague(league: InsertLeague, createdBy: number): Promise<League>;
  updateLeague(id: number, updates: Partial<League>): Promise<League | undefined>;
  getUserLeagues(userId: number): Promise<League[]>;
  
  // Players
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByLeague(leagueId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer & { leagueId: number }): Promise<Player>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined>;
  
  // Tier Lists
  getTierList(leagueId: number, userId: number): Promise<TierList | undefined>;
  getTierListsByLeague(leagueId: number): Promise<TierList[]>;
  createTierList(tierList: InsertTierList & { leagueId: number; userId: number }): Promise<TierList>;
  updateTierList(id: number, updates: Partial<TierList>): Promise<TierList | undefined>;
}

// PostgreSQL Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {

      return null;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {

      return null;
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email }, 
      process.env.JWT_SECRET || 'pachanga-secret-key', 
      { expiresIn: '7d' }
    );
    

    return { user, token };
  }

  async getLeague(id: number): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
    return league || undefined;
  }

  async getLeagueByInviteCode(inviteCode: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.inviteCode, inviteCode));
    return league || undefined;
  }

  async createLeague(league: InsertLeague, createdBy: number): Promise<League> {
    const [newLeague] = await db
      .insert(leagues)
      .values({
        name: league.name,
        description: league.description,
        inviteCode: nanoid(6).toUpperCase(),
        createdBy,
        participants: [createdBy],
        status: 'open',
        createdAt: new Date(),
      })
      .returning();
    return newLeague;
  }

  async updateLeague(id: number, updates: Partial<League>): Promise<League | undefined> {
    const [updated] = await db
      .update(leagues)
      .set(updates)
      .where(eq(leagues.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserLeagues(userId: number): Promise<League[]> {
    // Get leagues where user is creator or in participants array
    const userLeagues = await db.select().from(leagues).where(
      or(
        eq(leagues.createdBy, userId),
        sql`${leagues.participants} @> ${JSON.stringify([userId])}`
      )
    );
    
    return userLeagues;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getPlayersByLeague(leagueId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.leagueId, leagueId));
  }

  async createPlayer(player: InsertPlayer & { leagueId: number }): Promise<Player> {
    const [newPlayer] = await db
      .insert(players)
      .values(player)
      .returning();
    return newPlayer;
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const [updated] = await db
      .update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning();
    return updated || undefined;
  }

  async getTierList(leagueId: number, userId: number): Promise<TierList | undefined> {
    const [tierList] = await db
      .select()
      .from(tierLists)
      .where(and(eq(tierLists.leagueId, leagueId), eq(tierLists.userId, userId)));
    return tierList || undefined;
  }

  async getTierListsByLeague(leagueId: number): Promise<TierList[]> {
    return await db.select().from(tierLists).where(eq(tierLists.leagueId, leagueId));
  }

  async createTierList(tierList: InsertTierList & { leagueId: number; userId: number }): Promise<TierList> {
    const [newTierList] = await db
      .insert(tierLists)
      .values({
        leagueId: tierList.leagueId,
        userId: tierList.userId,
        playerOrder: tierList.playerOrder,
      })
      .returning();
    return newTierList;
  }

  async updateTierList(id: number, updates: Partial<TierList>): Promise<TierList | undefined> {
    const [updated] = await db
      .update(tierLists)
      .set(updates)
      .where(eq(tierLists.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();