import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { leagues } from "./leagues";
import { users } from "./users";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  emoji: text("emoji").notNull().default("⚽"),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  marketValue: integer("market_value").default(0),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  leagueId: true,
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof insertPlayerSchema._type;