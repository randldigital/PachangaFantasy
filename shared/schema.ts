import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("player"), // "admin" | "player"
  leagueId: integer("league_id"),
});

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: integer("created_by").notNull(),
  status: text("status").notNull().default("open"), // "open" | "voting" | "closed"
  participants: jsonb("participants").$type<number[]>().notNull().default([]),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  leagueId: integer("league_id").notNull(),
  marketValue: integer("market_value").default(0),
  emoji: text("emoji").notNull().default("⚽"),
});

export const tierLists = pgTable("tier_lists", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull(),
  userId: integer("user_id").notNull(),
  playerOrder: jsonb("player_order").$type<number[]>().notNull(),
  submitted: boolean("submitted").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  role: true,
});

export const insertLeagueSchema = createInsertSchema(leagues).pick({
  name: true,
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  position: true,
  emoji: true,
});

export const insertTierListSchema = createInsertSchema(tierLists).pick({
  playerOrder: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().min(1),
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
