import { pgTable, serial, integer, text, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { leagues } from "./leagues";
import { users } from "./users";

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  date: timestamp("date").notNull(),
  status: text("status", { enum: ["open", "closed", "completed"] }).notNull().default("open"),
  lineupBudget: integer("lineup_budget").default(100),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matchParticipants = pgTable("match_participants", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  userId: integer("user_id").references(() => users.id),
  playerId: integer("player_id"),
  status: text("status", { enum: ["accepted", "declined", "pending"] }).notNull().default("pending"),
});

export const lineups = pgTable("lineups", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  userId: integer("user_id").notNull().references(() => users.id),
  playerIds: jsonb("player_ids").$type<number[]>().notNull(),
  totalCost: integer("total_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdBy: true,
  createdAt: true,
});

export const insertLineupSchema = createInsertSchema(lineups).omit({
  id: true,
  createdAt: true,
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof insertMatchSchema._type;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type Lineup = typeof lineups.$inferSelect;
export type InsertLineup = typeof insertLineupSchema._type;