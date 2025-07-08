import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { leagues } from "./leagues";
import { users } from "./users";

export const tierLists = pgTable("tier_lists", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  userId: integer("user_id").notNull().references(() => users.id),
  playerOrder: jsonb("player_order").$type<number[]>().notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertTierListSchema = createInsertSchema(tierLists).omit({
  id: true,
  leagueId: true,
  userId: true,
  submittedAt: true,
});

export type TierList = typeof tierLists.$inferSelect;
export type InsertTierList = typeof insertTierListSchema._type;