import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./users";

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  inviteCode: text("invite_code").notNull().unique(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leagueParticipants = pgTable("league_participants", {
  userId: integer("user_id").notNull().references(() => users.id),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
}, (table) => ({
  pk: {
    primaryKey: [table.userId, table.leagueId],
  },
}));

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
  inviteCode: true,
  adminId: true,
  createdAt: true,
});

export type League = typeof leagues.$inferSelect;
export type InsertLeague = typeof insertLeagueSchema._type;
export type LeagueParticipant = typeof leagueParticipants.$inferSelect;