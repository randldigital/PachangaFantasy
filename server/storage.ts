import { users, leagues, players, tierLists, matches, matchParticipants, lineups, statReports, scores, type User, type InsertUser, type League, type InsertLeague, type Player, type InsertPlayer, type TierList, type InsertTierList, type Match, type InsertMatch, type MatchParticipant, type Lineup, type InsertLineup, type StatReport, type InsertStatReport, type Score } from "@shared/schema";
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
  deleteLeague(id: number): Promise<void>;
  getUserLeagues(userId: number): Promise<League[]>;
  
  // Players
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByLeague(leagueId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer & { leagueId: number; createdBy?: number; userId?: number }): Promise<Player>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined>;
  checkUserAsPlayer(userId: number, leagueId: number): Promise<Player | undefined>;
  
  // Tier Lists
  getTierList(leagueId: number, userId: number): Promise<TierList | undefined>;
  getTierListsByLeague(leagueId: number): Promise<TierList[]>;
  createTierList(tierList: InsertTierList & { leagueId: number; userId: number }): Promise<TierList>;
  updateTierList(id: number, updates: Partial<TierList>): Promise<TierList | undefined>;
  
  // v0.2 - Matches
  getMatch(id: number): Promise<Match | undefined>;
  getMatchesByLeague(leagueId: number): Promise<Match[]>;
  createMatch(match: InsertMatch & { createdBy: number }): Promise<Match>;
  updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined>;
  deleteMatch(id: number): Promise<void>;
  joinMatch(matchId: number, userId: number): Promise<MatchParticipant>;
  addPlayerToMatch(matchId: number, playerId: number): Promise<MatchParticipant>;
  getMatchParticipants(matchId: number): Promise<MatchParticipant[]>;
  balanceTeams(matchId: number, playerIds: number[]): Promise<{ teamA: number[], teamB: number[] }>;
  
  // v0.2 - Lineups
  getLineup(matchId: number, userId: number): Promise<Lineup | undefined>;
  createLineup(lineup: InsertLineup): Promise<Lineup>;
  updateLineup(id: number, updates: Partial<Lineup>): Promise<Lineup | undefined>;
  
  // v0.2 - Stats & Scoring
  createStatReport(statReport: InsertStatReport): Promise<StatReport>;
  getStatReportsForMatch(matchId: number): Promise<StatReport[]>;
  validateMatchGoals(matchId: number, finalScore: number): Promise<{ isValid: boolean; reportedTotal: number; difference: number }>;
  calculateMatchScores(matchId: number): Promise<Score[]>;
  getLeagueRankings(leagueId: number): Promise<{ userId: number, username: string, totalPoints: number }[]>;
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
    try {
      console.log('Storage: Starting user creation for:', insertUser.email);
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      console.log('Storage: Password hashed successfully');
      
      const [user] = await db
        .insert(users)
        .values({
          ...insertUser,
          password: hashedPassword,
        })
        .returning();
      
      console.log('Storage: User created successfully:', user.id);
      return user;
    } catch (error) {
      console.error('Storage: Error creating user:', error);
      throw error;
    }
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

  async deleteLeague(id: number): Promise<void> {
    // Get all matches in this league first
    const leagueMatches = await this.getMatchesByLeague(id);
    
    // Delete all matches and their related data
    for (const match of leagueMatches) {
      await this.deleteMatch(match.id);
    }
    
    // Delete tier lists for this league
    await db.delete(tierLists).where(eq(tierLists.leagueId, id));
    
    // Delete players in this league
    await db.delete(players).where(eq(players.leagueId, id));
    
    // Finally delete the league
    await db.delete(leagues).where(eq(leagues.id, id));
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

  async createPlayer(player: InsertPlayer & { leagueId: number; createdBy?: number; userId?: number }): Promise<Player> {
    const [newPlayer] = await db
      .insert(players)
      .values({
        name: player.name,
        position: player.position || 'forward',
        emoji: player.emoji,
        leagueId: player.leagueId,
        createdBy: player.createdBy,
        userId: player.userId,
      })
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

  async checkUserAsPlayer(userId: number, leagueId: number): Promise<Player | undefined> {
    const [player] = await db
      .select()
      .from(players)
      .where(and(eq(players.userId, userId), eq(players.leagueId, leagueId)));
    return player || undefined;
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
    // Explicitly type the values to match the database schema
    const insertValues = {
      leagueId: tierList.leagueId,
      userId: tierList.userId,
      playerOrder: tierList.playerOrder as number[],
      submitted: tierList.submitted ?? false
    };
    
    const [newTierList] = await db
      .insert(tierLists)
      .values(insertValues)
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

  // v0.2 - Matches Implementation
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match || undefined;
  }

  async getMatchesByLeague(leagueId: number): Promise<Match[]> {
    return await db.select().from(matches).where(eq(matches.leagueId, leagueId));
  }

  async createMatch(match: InsertMatch & { createdBy: number }): Promise<Match> {
    const [created] = await db.insert(matches).values(match).returning();
    return created;
  }

  async updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined> {
    const [match] = await db
      .update(matches)
      .set(updates)
      .where(eq(matches.id, id))
      .returning();
    return match || undefined;
  }

  async deleteMatch(id: number): Promise<void> {
    // Delete in order to respect foreign key constraints
    await db.delete(scores).where(eq(scores.matchId, id));
    await db.delete(statReports).where(eq(statReports.matchId, id));
    await db.delete(lineups).where(eq(lineups.matchId, id));
    await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
    await db.delete(matches).where(eq(matches.id, id));
  }

  async joinMatch(matchId: number, userId: number): Promise<MatchParticipant> {
    // First find the user's player ID in the match's league
    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }
    
    const userPlayer = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.userId, userId),
          eq(players.leagueId, match.leagueId)
        )
      )
      .limit(1);

    if (userPlayer.length === 0) {
      throw new Error('User is not a player in this league');
    }

    const playerId = userPlayer[0].id;
    
    // Check if player is already a participant
    const existingParticipant = await db
      .select()
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.playerId, playerId)
        )
      )
      .limit(1);

    if (existingParticipant.length > 0) {
      return existingParticipant[0];
    }

    // Player is not a participant yet, add them
    const [participant] = await db
      .insert(matchParticipants)
      .values({ matchId, playerId, status: 'accepted' })
      .returning();
    
    return participant;
  }

  async addPlayerToMatch(matchId: number, playerId: number): Promise<MatchParticipant> {
    try {
      // Check if this player is already in the match
      const existingParticipant = await db
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.playerId, playerId)
          )
        )
        .limit(1);

      if (existingParticipant.length > 0) {
        // Player is already a participant, return the existing record
        return existingParticipant[0];
      }

      // Player is not a participant yet, add them
      const [participant] = await db
        .insert(matchParticipants)
        .values({ matchId, playerId, status: 'accepted' })
        .returning();
      return participant;
    } catch (error) {
      console.error('Error adding player to match:', error);
      throw new Error('Failed to add player to match');
    }
  }

  async getMatchParticipants(matchId: number): Promise<MatchParticipant[]> {
    return await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId));
  }

  async balanceTeams(matchId: number, playerIds: number[]): Promise<{ teamA: number[], teamB: number[] }> {
    // Get players with their market values for balancing
    const playersData = await db
      .select()
      .from(players)
      .where(sql`id = ANY(${playerIds})`);

    // Sort by market value and distribute alternately for balance
    const sortedPlayers = playersData.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
    const teamA: number[] = [];
    const teamB: number[] = [];

    sortedPlayers.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player.id);
      } else {
        teamB.push(player.id);
      }
    });

    const teams = { teamA, teamB };
    
    // Update match with balanced teams
    await this.updateMatch(matchId, { matchTeams: teams });
    
    return teams;
  }

  // v0.2 - Lineups Implementation
  async getLineup(matchId: number, userId: number): Promise<Lineup | undefined> {
    const [lineup] = await db
      .select()
      .from(lineups)
      .where(and(eq(lineups.matchId, matchId), eq(lineups.userId, userId)));
    return lineup || undefined;
  }

  async createLineup(lineup: InsertLineup): Promise<Lineup> {
    const [created] = await db.insert(lineups).values(lineup).returning();
    return created;
  }

  async updateLineup(id: number, updates: Partial<Lineup>): Promise<Lineup | undefined> {
    const [lineup] = await db
      .update(lineups)
      .set(updates)
      .where(eq(lineups.id, id))
      .returning();
    return lineup || undefined;
  }

  // v1.0 - Simplified Stats Implementation
  async createStatReport(statReport: InsertStatReport): Promise<StatReport> {
    const [created] = await db
      .insert(statReports)
      .values(statReport)
      .returning();
    return created;
  }

  async getStatReportsForMatch(matchId: number): Promise<StatReport[]> {
    return await db
      .select()
      .from(statReports)
      .where(eq(statReports.matchId, matchId));
  }

  // v1.0 - Admin goal validation
  async validateMatchGoals(matchId: number, finalScore: number): Promise<{ isValid: boolean; reportedTotal: number; difference: number }> {
    const statReports = await this.getStatReportsForMatch(matchId);
    const reportedTotal = statReports.reduce((sum, report) => sum + (report.goals || 0), 0);
    const difference = reportedTotal - finalScore;
    
    return {
      isValid: difference === 0,
      reportedTotal,
      difference
    };
  }

  async calculateMatchScores(matchId: number): Promise<Score[]> {
    const reports = await this.getStatReportsForMatch(matchId);
    
    const match = await this.getMatch(matchId);
    const teams = match?.matchTeams;
    
    let teamAWins = false;
    let teamBWins = false;
    
    if (teams) {
      const teamAGoals = reports
        .filter(r => teams.teamA.includes(r.userId))
        .reduce((sum, r) => sum + (r.goals || 0), 0);
      
      const teamBGoals = reports
        .filter(r => teams.teamB.includes(r.userId))
        .reduce((sum, r) => sum + (r.goals || 0), 0);
      
      teamAWins = teamAGoals > teamBGoals;
      teamBWins = teamBGoals > teamAGoals;
    }

    const matchScores: Score[] = [];
    
    for (const report of reports) {
      const points = 
        (report.goals || 0) * 3 + 
        (report.assists || 0) * 2 + 
        (teams && 
          ((teamAWins && teams.teamA.includes(report.userId)) || 
           (teamBWins && teams.teamB.includes(report.userId))) ? 1 : 0);
      
      const [score] = await db
        .insert(scores)
        .values({
          userId: report.userId,
          matchId: report.matchId,
          points,
        })
        .returning();
      
      matchScores.push(score);
    }
    
    return matchScores;
  }

  async getLeagueRankings(leagueId: number): Promise<{ userId: number, username: string, totalPoints: number }[]> {
    const result = await db
      .select({
        userId: users.id,
        username: users.username,
        totalPoints: sql<number>`COALESCE(SUM(${scores.points}), 0)`,
      })
      .from(users)
      .leftJoin(scores, eq(users.id, scores.userId))
      .leftJoin(matches, eq(scores.matchId, matches.id))
      .where(eq(matches.leagueId, leagueId))
      .groupBy(users.id, users.username)
      .orderBy(sql`COALESCE(SUM(${scores.points}), 0) DESC`);
    
    return result;
  }
}

export const storage = new DatabaseStorage();