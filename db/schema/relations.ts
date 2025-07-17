import { relations } from "drizzle-orm";
import { users } from "./users";
import { leagues, leagueParticipants } from "./leagues";
import { players } from "./players";
import { tierLists } from "./tierLists";
import { matches, matchParticipants, lineups } from "./matches";
import { statReports, votes, scores } from "./stats";

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  adminLeagues: many(leagues),
  leagueParticipations: many(leagueParticipants),
  createdPlayers: many(players),
  tierLists: many(tierLists),
  createdMatches: many(matches),
  matchParticipations: many(matchParticipants),
  lineups: many(lineups),
  statReports: many(statReports),
  votes: many(votes),
  scores: many(scores),
}));

// League relations
export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  admin: one(users, {
    fields: [leagues.adminId],
    references: [users.id],
  }),
  participants: many(leagueParticipants),
  players: many(players),
  tierLists: many(tierLists),
  matches: many(matches),
}));

export const leagueParticipantsRelations = relations(leagueParticipants, ({ one }) => ({
  user: one(users, {
    fields: [leagueParticipants.userId],
    references: [users.id],
  }),
  league: one(leagues, {
    fields: [leagueParticipants.leagueId],
    references: [leagues.id],
  }),
}));

// Player relations
export const playersRelations = relations(players, ({ one }) => ({
  league: one(leagues, {
    fields: [players.leagueId],
    references: [leagues.id],
  }),
  creator: one(users, {
    fields: [players.createdBy],
    references: [users.id],
  }),
}));

// Tier list relations
export const tierListsRelations = relations(tierLists, ({ one }) => ({
  league: one(leagues, {
    fields: [tierLists.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [tierLists.userId],
    references: [users.id],
  }),
}));

// Match relations
export const matchesRelations = relations(matches, ({ one, many }) => ({
  league: one(leagues, {
    fields: [matches.leagueId],
    references: [leagues.id],
  }),
  creator: one(users, {
    fields: [matches.createdBy],
    references: [users.id],
  }),
  participants: many(matchParticipants),
  lineups: many(lineups),
  statReports: many(statReports),
  votes: many(votes),
  scores: many(scores),
}));

export const matchParticipantsRelations = relations(matchParticipants, ({ one }) => ({
  match: one(matches, {
    fields: [matchParticipants.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [matchParticipants.playerId],
    references: [players.id],
  }),
}));

export const lineupsRelations = relations(lineups, ({ one }) => ({
  match: one(matches, {
    fields: [lineups.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [lineups.userId],
    references: [users.id],
  }),
}));

// Stats relations
export const statReportsRelations = relations(statReports, ({ one }) => ({
  match: one(matches, {
    fields: [statReports.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [statReports.userId],
    references: [users.id],
  }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  match: one(matches, {
    fields: [votes.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  user: one(users, {
    fields: [scores.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [scores.matchId],
    references: [matches.id],
  }),
}));