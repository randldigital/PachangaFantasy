import { users, leagues, players, tierLists, type User, type InsertUser, type League, type InsertLeague, type Player, type InsertPlayer, type TierList, type InsertTierList } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private leagues: Map<number, League>;
  private players: Map<number, Player>;
  private tierLists: Map<number, TierList>;
  private currentUserId: number;
  private currentLeagueId: number;
  private currentPlayerId: number;
  private currentTierListId: number;

  constructor() {
    this.users = new Map();
    this.leagues = new Map();
    this.players = new Map();
    this.tierLists = new Map();
    this.currentUserId = 1;
    this.currentLeagueId = 1;
    this.currentPlayerId = 1;
    this.currentTierListId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const id = this.currentUserId++;
    const user: User = {
      id,
      email: insertUser.email,
      username: insertUser.username,
      password: hashedPassword,
      role: insertUser.role || 'player',
      leagueId: null,
    };
    this.users.set(id, user);
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    return { user, token };
  }

  async getLeague(id: number): Promise<League | undefined> {
    return this.leagues.get(id);
  }

  async getLeagueByInviteCode(inviteCode: string): Promise<League | undefined> {
    return Array.from(this.leagues.values()).find(league => league.inviteCode === inviteCode);
  }

  async createLeague(insertLeague: InsertLeague, createdBy: number): Promise<League> {
    const id = this.currentLeagueId++;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const league: League = {
      ...insertLeague,
      id,
      inviteCode,
      createdBy,
      status: "open",
      participants: [createdBy],
    };
    this.leagues.set(id, league);
    return league;
  }

  async updateLeague(id: number, updates: Partial<League>): Promise<League | undefined> {
    const league = this.leagues.get(id);
    if (!league) return undefined;

    const updatedLeague = { ...league, ...updates };
    this.leagues.set(id, updatedLeague);
    return updatedLeague;
  }

  async getUserLeagues(userId: number): Promise<League[]> {
    return Array.from(this.leagues.values()).filter(league => 
      league.participants && league.participants.includes(userId)
    );
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersByLeague(leagueId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.leagueId === leagueId);
  }

  async createPlayer(player: InsertPlayer & { leagueId: number }): Promise<Player> {
    const id = this.currentPlayerId++;
    const newPlayer: Player = {
      id,
      name: player.name,
      position: player.position,
      emoji: player.emoji || '⚽',
      leagueId: player.leagueId,
      marketValue: 0,
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;

    const updatedPlayer = { ...player, ...updates };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  async getTierList(leagueId: number, userId: number): Promise<TierList | undefined> {
    return Array.from(this.tierLists.values()).find(
      tierList => tierList.leagueId === leagueId && tierList.userId === userId
    );
  }

  async getTierListsByLeague(leagueId: number): Promise<TierList[]> {
    return Array.from(this.tierLists.values()).filter(tierList => tierList.leagueId === leagueId);
  }

  async createTierList(tierList: InsertTierList & { leagueId: number; userId: number }): Promise<TierList> {
    const id = this.currentTierListId++;
    const newTierList: TierList = {
      id,
      leagueId: tierList.leagueId,
      userId: tierList.userId,
      playerOrder: Array.isArray(tierList.playerOrder) ? tierList.playerOrder : [],
      submitted: true,
    };
    this.tierLists.set(id, newTierList);
    return newTierList;
  }

  async updateTierList(id: number, updates: Partial<TierList>): Promise<TierList | undefined> {
    const tierList = this.tierLists.get(id);
    if (!tierList) return undefined;

    const updatedTierList = { ...tierList, ...updates };
    this.tierLists.set(id, updatedTierList);
    return updatedTierList;
  }
}

export const storage = new MemStorage();
