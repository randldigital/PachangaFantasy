import { pgTable, serial, integer, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { matches } from "./matches";
import { users } from "./users";

export const statReports = pgTable("stat_reports", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  userId: integer("user_id").notNull().references(() => users.id),
  goals: integer("goals").default(0),
  assists: integer("assists").default(0),
  verifiedBy: integer("verified_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  userId: integer("user_id").notNull().references(() => users.id),
  mvps: jsonb("mvps").$type<number[]>().notNull(),
  flops: jsonb("flops").$type<number[]>().notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const scores = pgTable("scores", {
  userId: integer("user_id").notNull().references(() => users.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  points: integer("points").notNull().default(0),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.matchId] }),
}));

export const insertStatReportSchema = createInsertSchema(statReports).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  submittedAt: true,
});

export type StatReport = typeof statReports.$inferSelect;
export type InsertStatReport = typeof insertStatReportSchema._type;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof insertVoteSchema._type;
export type Score = typeof scores.$inferSelect;