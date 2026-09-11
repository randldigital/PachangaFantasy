import { pgTable, text, serial, integer, boolean, jsonb, timestamp, json, primaryKey, uniqueIndex, index, doublePrecision } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { ValuationTier } from "./domain/valuation";
import { isValidInviteCode } from "./domain/inviteCodes";
import { DEFAULT_SIDE_SIZE } from "./domain/teams";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password"),
  // Vestigial: unused for authorisation. League admin is leagues.createdBy. Phase 2.
  role: text("role").notNull().default("player"), // "admin" | "player"
  // Vestigial: users may belong to many leagues. Phase 2.
  leagueId: integer("league_id"),
  avatarPath: text("avatar_path"),
  emailVerifiedAt: timestamp("email_verified_at"),
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
  joinOpen: boolean("join_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * A Club is the persistent real squad of Club Mode. It is a sibling of `leagues`, not a
 * flag on one: no lineups, no Team A/B and no Fantasy managers. It does have valuation
 * and Market Value (same S/A/B/C/D close as a League).
 */
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: integer("created_by").notNull(),
  status: text("status").notNull().default("open"), // "open" | "voting" | "closed"
  participants: jsonb("participants").$type<number[]>().notNull().default([]),
  scoringBaseline: doublePrecision("scoring_baseline").notNull().default(5),
  joinOpen: boolean("join_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

/** A Player belongs to exactly one context: `leagueId` XOR `clubId` (DB check constraint). */
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  leagueId: integer("league_id"),
  clubId: integer("club_id"),
  marketValue: integer("market_value").default(0),
  emoji: text("emoji").notNull().default("⚽"),
  isExternal: boolean("is_external").default(false),
  createdBy: integer("created_by"),
  userId: integer("user_id"), // Optional FK to users.id for user-players
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  clubIdx: index("players_club").on(table.clubId),
}));

/**
 * A join whose alias matches an unlinked Player becomes a claim request instead of a
 * silent link. Membership is withheld until an administrator accepts or rejects.
 */
export const playerClaimRequests = pgTable("player_claim_requests", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").$type<"pending" | "accepted" | "rejected">().notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by"),
}, (table) => ({
  pendingPairUnique: uniqueIndex("player_claim_requests_pending_pair")
    .on(table.playerId, table.userId)
    .where(sql`status = 'pending'`),
}));

export const playerTierPlacementSchema = z.object({
  playerId: z.number().int(),
  tier: z.enum(["S", "A", "B", "C", "D"]),
});

export type PlayerTierPlacementInput = z.infer<typeof playerTierPlacementSchema>;

/** A tier list belongs to exactly one context: `leagueId` XOR `clubId` (DB check constraint). */
export const tierLists = pgTable("tier_lists", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id"),
  clubId: integer("club_id"),
  userId: integer("user_id").notNull(),
  playerTiers: jsonb("player_tiers").$type<{ playerId: number; tier: ValuationTier }[]>().notNull(),
  submitted: boolean("submitted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// v0.2 Features - Matches System
/** A Match belongs to exactly one context: `leagueId` XOR `clubId` (DB check constraint). */
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  clubId: integer("club_id").references(() => clubs.id),
  date: timestamp("date").notNull(),
  // Fantasy only.
  lineupBudget: integer("lineup_budget").default(100),
  // Fantasy only: players per side (5 / 7 / 11). Immutable once the match exists.
  sideSize: integer("side_size").notNull().default(5),
  status: text("status").$type<"open" | "started" | "completed" | "scored" | "closed">().default("open"),
  // Fantasy only.
  matchTeams: json("match_teams").$type<{ teamA: number[], teamB: number[] }>(),
  finalScore: integer("final_score"),
  teamAGoals: integer("team_a_goals"),
  teamBGoals: integer("team_b_goals"),
  // Club only: the opponent is a name and a score, never a roster.
  opponentName: text("opponent_name"),
  ourGoals: integer("our_goals"),
  opponentGoals: integer("opponent_goals"),
  statsAcknowledged: boolean("stats_acknowledged").notNull().default(false),
  createdBy: integer("created_by").notNull().references(() => users.id),
  // Season the match belongs to (1 Aug – 31 Jul), derived from `date` at creation.
  seasonKey: text("season_key"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  leagueSeasonIdx: index("matches_league_season").on(table.leagueId, table.seasonKey),
  clubSeasonIdx: index("matches_club_season").on(table.clubId, table.seasonKey),
}));

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
  // Club only (0–120); null on Fantasy rows.
  minutes: integer("minutes"),
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
  points: doublePrecision("points").notNull(),
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
  points: doublePrecision("points").notNull(),
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
  // Fantasy ballots are teammate/rival; Club ballots are a single undifferentiated pool.
  kind: text("kind").$type<"teammate" | "rival" | "club">().notNull(),
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
  score: doublePrecision("score").notNull(),
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

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const authIdentities = pgTable("auth_identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  providerUserUnique: uniqueIndex("auth_identities_provider_user").on(table.provider, table.providerUserId),
}));

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const billingAccounts = pgTable("billing_accounts", {
  id: serial("id").primaryKey(),
  subjectType: text("subject_type").$type<"user" | "league" | "club">().notNull(),
  subjectId: integer("subject_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  subjectUnique: uniqueIndex("billing_accounts_subject").on(table.subjectType, table.subjectId),
}));

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  billingAccountId: integer("billing_account_id").notNull().references(() => billingAccounts.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  accountUnique: uniqueIndex("subscriptions_billing_account").on(table.billingAccountId),
}));

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  billingAccountId: integer("billing_account_id").notNull().references(() => billingAccounts.id),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  amountCents: integer("amount_cents").notNull().default(0),
  currency: text("currency").notNull().default("eur"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  joinOpen: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Name is required").max(25, "Name must be 25 characters or less"),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
});

/** The visible football identity inside one League or one Club. */
export const aliasSchema = z
  .string()
  .trim()
  .min(1, "Alias is required")
  .max(30, "Alias must be 30 characters or less");

export const inviteCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(isValidInviteCode, "Invite code must be L-XXXXXX or C-XXXXXX");

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

export const createLeagueSchema = insertLeagueSchema.extend({
  alias: aliasSchema,
});

export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  inviteCode: true,
  createdBy: true,
  status: true,
  participants: true,
  scoringBaseline: true,
  joinOpen: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Name is required").max(25, "Name must be 25 characters or less"),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
});

export const createClubSchema = insertClubSchema.extend({
  alias: aliasSchema,
});

export const joinWithAliasSchema = z.object({
  alias: aliasSchema,
});

/** Join with a new alias, or claim an existing unlinked Player. Never both. */
export const joinOrganisationSchema = z
  .object({
    alias: z.string().optional(),
    playerId: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    const alias = typeof value.alias === "string" ? value.alias.trim() : "";
    const hasAlias = alias.length > 0;
    const hasPlayer = value.playerId != null;
    if (hasAlias === hasPlayer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Send either an alias or a playerId",
      });
      return;
    }
    if (hasAlias) {
      const parsed = aliasSchema.safeParse(alias);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ ...issue, path: ["alias"] });
        }
      }
    }
  });

export const joinByPlayerIdSchema = z.object({
  playerId: z.number().int().positive(),
});

export const updateAliasSchema = z.object({
  alias: aliasSchema,
});

export const resolveClaimSchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

export const membershipSchema = z.object({
  joinOpen: z.boolean(),
});

export const billingCheckoutSchema = z.object({
  billingAccountId: z.number().int().positive(),
  planCode: z.string().min(1),
});

export const billingSubjectQuerySchema = z.object({
  type: z.enum(["user", "league", "club"]),
  id: z.coerce.number().int().positive(),
});

// v0.2 Insert Schemas
const matchDateSchema = z.string().min(1, "Date is required").refine((str) => {
  const date = new Date(str);
  return !isNaN(date.getTime());
}, "Invalid date format").transform((str) => new Date(str));

/** Fantasy Match: a League, a side size and a lineup budget. */
export const insertMatchSchema = z.object({
  leagueId: z.number().int().positive(),
  date: matchDateSchema,
  lineupBudget: z
    .number()
    .min(50, "Budget must be at least 50")
    .max(200, "Budget cannot exceed 200")
    .default(100),
  sideSize: z
    .union([z.literal(5), z.literal(7), z.literal(11)])
    .default(DEFAULT_SIDE_SIZE),
});

/** Club Match: a Club and a date. No side size, no budget, no Team A/B. */
export const insertClubMatchSchema = z.object({
  clubId: z.number().int().positive(),
  date: matchDateSchema,
  opponentName: z.string().trim().max(40).optional(),
});

/**
 * A Match belongs to exactly one context. Callers send `leagueId` or `clubId`, never both:
 * Fantasy-only fields on a Club Match (and vice versa) are rejected rather than ignored.
 */
export const createMatchSchema = z
  .object({ leagueId: z.unknown().optional(), clubId: z.unknown().optional() })
  .passthrough()
  .superRefine((value, ctx) => {
    const hasLeague = value.leagueId != null;
    const hasClub = value.clubId != null;
    if (hasLeague === hasClub) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A match belongs to either a league or a club, not both",
      });
    }
    if (hasClub && (value as Record<string, unknown>).sideSize != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Club matches have no side size" });
    }
    if (hasClub && (value as Record<string, unknown>).lineupBudget != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Club matches have no lineup budget" });
    }
  });

export const clubResultSchema = z.object({
  opponentName: z.string().trim().min(1, "Opponent name is required").max(40),
  ourGoals: z.coerce.number().int().min(0),
  opponentGoals: z.coerce.number().int().min(0),
});

export const saveLineupSchema = z.object({
  playerIds: z.array(z.number().int()),
  captainId: z.number().int(),
});

export const submitStatsSchema = z.object({
  goals: z.coerce.number().int().min(0),
  assists: z.coerce.number().int().min(0),
  playerId: z.number().int().positive().optional(),
  /** Club only: 0–120. Rejected on Fantasy matches. */
  minutes: z.coerce.number().int().min(0).max(120).optional(),
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
      score: z.coerce
        .number()
        .min(0)
        .max(10)
        .transform((value) => Math.round(value * 10) / 10),
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
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type JoinWithAliasInput = z.infer<typeof joinWithAliasSchema>;
export type JoinOrganisationInput = z.infer<typeof joinOrganisationSchema>;
export type PlayerClaimRequest = typeof playerClaimRequests.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type InsertClubMatch = z.infer<typeof insertClubMatchSchema>;
export type ClubResultInput = z.infer<typeof clubResultSchema>;

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
export type Plan = typeof plans.$inferSelect;
export type BillingAccount = typeof billingAccounts.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type MembershipInput = z.infer<typeof membershipSchema>;
export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>;
