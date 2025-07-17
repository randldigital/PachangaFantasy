import { pgTable, serial, integer, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { matches } from './matches';
import { users } from './users';

export const lineups = pgTable('lineups', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => matches.id),
  userId: integer('user_id').notNull().references(() => users.id),
  playerIds: jsonb('player_ids').notNull(),
  captainId: integer('captain_id').notNull(),
  totalCost: integer('total_cost').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (lineups) => ({
  uniqueMatchUser: unique().on(lineups.matchId, lineups.userId),
})); 