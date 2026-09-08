import { pgTable, text, serial, integer, boolean, jsonb, timestamp, json, primaryKey, uniqueIndex, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { ValuationTier } from "./domain/valuation";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  // Vestigial: unused for authorisation. League admin is leagues.createdBy. Phase 2.
  role: text("role").notNull().default("player"), // "admin" | "player"
  // Vestigial: users may belong to many leagues. Phase 2.
  leagueId: integer("league_id"),
});

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: integer("created_by").notNull(),
  status: text("status").notNull().default("open"), // "open" | "voting" | "closed"
  participants: jsonb("participants").$type<number[]>().notNull().default([]),
  scoringBaseline: doublePrecision("scoring_baseline").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  leagueId: integer("league_id").notNull(),
  marketValue: integer("market_value").default(0),
  emoji: text("emoji").notNull().default("⚽"),
  isExternal: boolean("is_external").default(false),
  createdBy: integer("created_by"),
  userId: integer("user_id"), // Optional FK to users.id for user-players
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerTierPlacementSchema = z.object({
  playerId: z.number().int(),
  tier: z.enum(["S", "A", "B", "C", "D"]),
});

export type PlayerTierPlacementInput = z.infer<typeof playerTierPlacementSchema>;

export const tierLists = pgTable("tier_lists", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull(),
  userId: integer("user_id").notNull(),
  playerTiers: jsonb("player_tiers").$type<{ playerId: number; tier: ValuationTier }[]>().notNull(),
  submitted: boolean("submitted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// v0.2 Features - Matches System
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  date: timestamp("date").notNull(),
  lineupBudget: integer("lineup_budget").default(100),
  status: text("status").$type<"open" | "started" | "completed" | "scored">().default("open"),
  matchTeams: json("match_teams").$type<{ teamA: number[], teamB: number[] }>(),
  finalScore: integer("final_score"),
  teamAGoals: integer("team_a_goals"),
  teamBGoals: integer("team_b_goals"),
  statsAcknowledged: boolean("stats_acknowledged").notNull().default(false),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchParticipants = pgTable("match_participants", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerId: integer("player_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  status: text("status", { enum: ["accepted", "declined", "pending"] }).notNull().default("pending"),
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.playerId] }),
}));

export const lineups = pgTable("lineups", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  userId: integer("user_id").notNull().references(() => users.id),
  playerIds: integer("player_ids").array().notNull(),
  captainId: integer("captain_id").notNull(),
  totalCost: integer("total_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statReports = pgTable("stat_reports", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  goals: integer("goals").default(0),
  assists: integer("assists").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matchPlayerUnique: uniqueIndex("stat_reports_match_player").on(table.matchId, table.playerId),
}));

export const playerMatchPoints = pgTable("player_match_points", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matchPlayerUnique: uniqueIndex("player_match_points_match_player").on(table.matchId, table.playerId),
}));

export const managerMatchPoints = pgTable("manager_match_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerIds: integer("player_ids").array(),
  captainId: integer("captain_id"),
  points: integer("points").notNull(),
  lineupStatus: text("lineup_status").$type<"ok" | "missing" | "invalid">().notNull().default("ok"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matchUserUnique: uniqueIndex("manager_match_points_match_user").on(table.matchId, table.userId),
}));

export const matchPlayerVm = pgTable("match_player_vm", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  marketValue: integer("market_value").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.playerId] }),
}));

export const matchRatingAssignments = pgTable("match_rating_assignments", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  raterPlayerId: integer("rater_player_id").notNull().references(() => players.id),
  rateePlayerId: integer("ratee_player_id").notNull().references(() => players.id),
  kind: text("kind").$type<"teammate" | "rival">().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.raterPlayerId, table.rateePlayerId] }),
}));

export const matchMvpVotes = pgTable("match_mvp_votes", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  voterPlayerId: integer("voter_player_id").notNull().references(() => players.id),
  mvpPlayerId: integer("mvp_player_id").notNull().references(() => players.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.voterPlayerId] }),
}));

export const matchPeerRatings = pgTable("match_peer_ratings", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  raterPlayerId: integer("rater_player_id").notNull().references(() => players.id),
  rateePlayerId: integer("ratee_player_id").notNull().references(() => players.id),
  score: integer("score").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.raterPlayerId, table.rateePlayerId] }),
}));

export const playerMarketValueHistory = pgTable("player_market_value_history", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  vmBefore: integer("vm_before").notNull(),
  vmAfter: integer("vm_after").notNull(),
  delta: integer("delta").notNull(),
  mvp: doublePrecision("mvp").notNull(),
  peer: doublePrecision("peer").notNull(),
  offensive: doublePrecision("offensive").notNull(),
  result: doublePrecision("result").notNull(),
  performanceScore: doublePrecision("performance_score").notNull(),
  rawChange: doublePrecision("raw_change").notNull(),
  multiplier: doublePrecision("multiplier").notNull(),
  adjustedContribution: doublePrecision("adjusted_contribution").notNull(),
  expectedContribution: doublePrecision("expected_contribution").notNull(),
  baseline: doublePrecision("baseline").notNull(),
  ownTeamAvgVm: doublePrecision("own_team_avg_vm").notNull(),
  oppTeamAvgVm: doublePrecision("opp_team_avg_vm").notNull(),
  mvpVotes: integer("mvp_votes").notNull().default(0),
  peerAverage: doublePrecision("peer_average"),
  breakdown: jsonb("breakdown").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matchPlayerUnique: uniqueIndex("player_market_value_history_match_player").on(table.matchId, table.playerId),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
}).strip();

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
  inviteCode: true,
  createdBy: true,
  status: true,
  participants: true,
  scoringBaseline: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Name is required").max(25, "Name must be 25 characters or less"),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  emoji: true,
  isExternal: true,
}).extend({
  name: z.string().min(1, "Name is required").max(30, "Name must be 30 characters or less"),
  isExternal: z.boolean().default(false).optional(),
});

export const insertTierListSchema = z.object({
  playerTiers: z.array(playerTierPlacementSchema),
  submitted: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().min(1),
});

// v0.2 Insert Schemas
export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  status: true,
  matchTeams: true,
  createdBy: true,
  createdAt: true,
  finalScore: true,
  teamAGoals: true,
  teamBGoals: true,
}).extend({
  date: z.string().min(1, "Date is required").refine((str) => {
    const date = new Date(str);
    return !isNaN(date.getTime());
  }, "Invalid date format").transform((str) => new Date(str)),
  lineupBudget: z.number().min(50, "Budget must be at least 50").max(200, "Budget cannot exceed 200"),
});

export const saveLineupSchema = z.object({
  playerIds: z.array(z.number().int()),
  captainId: z.number().int(),
});

export const submitStatsSchema = z.object({
  goals: z.coerce.number().int().min(0),
  assists: z.coerce.number().int().min(0),
  playerId: z.number().int().positive().optional(),
});

export const insertStatReportSchema = createInsertSchema(statReports).omit({
  id: true,
  createdAt: true,
});

export const endMatchSchema = z.object({
  teamAGoals: z.coerce.number().int().min(0),
  teamBGoals: z.coerce.number().int().min(0),
});

export const saveTeamsSchema = z.object({
  teamA: z.array(z.number().int()).min(1),
  teamB: z.array(z.number().int()).min(1),
});

export const submitRatingsSchema = z.object({
  mvpPlayerId: z.number().int().positive(),
  ratings: z.array(
    z.object({
      playerId: z.number().int().positive(),
      score: z.coerce.number().int().min(1).max(5),
    }),
  ),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type League = typeof leagues.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;
export type InsertTierList = z.infer<typeof insertTierListSchema>;
export type TierList = typeof tierLists.$inferSelect;
export type LoginInput = z.infer<typeof loginSchema>;
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;

// v0.2 Types
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type Lineup = typeof lineups.$inferSelect;
export type InsertLineup = typeof lineups.$inferInsert;
export type StatReport = typeof statReports.$inferSelect;
export type InsertStatReport = typeof statReports.$inferInsert;
export type PlayerMatchPoints = typeof playerMatchPoints.$inferSelect;
export type ManagerMatchPoints = typeof managerMatchPoints.$inferSelect;
export type SubmitStatsInput = z.infer<typeof submitStatsSchema>;
export type EndMatchInput = z.infer<typeof endMatchSchema>;
export type SubmitRatingsInput = z.infer<typeof submitRatingsSchema>;
export type MatchPlayerVm = typeof matchPlayerVm.$inferSelect;
export type MatchRatingAssignment = typeof matchRatingAssignments.$inferSelect;
export type MatchMvpVote = typeof matchMvpVotes.$inferSelect;
export type MatchPeerRating = typeof matchPeerRatings.$inferSelect;
export type PlayerMarketValueHistory = typeof playerMarketValueHistory.$inferSelect;
