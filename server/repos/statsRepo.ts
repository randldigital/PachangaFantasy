import { statReports, type StatReport, type InsertStatReport, type Match } from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { statsSubmissionState, type StatsStatus } from "@shared/domain/stats";
import type { MatchParticipant } from "@shared/schema";

export async function createStatReport(statReport: InsertStatReport): Promise<StatReport> {
  const [created] = await db.insert(statReports).values(statReport).returning();
  return created;
}

export async function updateStatReport(
  reportId: number,
  updates: Pick<InsertStatReport, "goals" | "assists" | "minutes">,
): Promise<StatReport | undefined> {
  const [updated] = await db
    .update(statReports)
    .set(updates)
    .where(eq(statReports.id, reportId))
    .returning();
  return updated || undefined;
}

export async function getStatReportsForMatch(matchId: number): Promise<StatReport[]> {
  return await db.select().from(statReports).where(eq(statReports.matchId, matchId));
}

export async function getStatReportForPlayer(
  matchId: number,
  playerId: number,
): Promise<StatReport | undefined> {
  const [report] = await db
    .select()
    .from(statReports)
    .where(and(eq(statReports.matchId, matchId), eq(statReports.playerId, playerId)));
  return report || undefined;
}

export async function getStatReportById(reportId: number): Promise<StatReport | undefined> {
  const [report] = await db.select().from(statReports).where(eq(statReports.id, reportId));
  return report || undefined;
}

export function matchStatsStatus(
  match: Match,
  participants: MatchParticipant[],
  reports: StatReport[],
): StatsStatus {
  const participantPlayerIds = participants
    .filter((participant) => participant.status === "accepted")
    .map((participant) => participant.playerId);
  const isClub = match.clubId != null;
  const sides = isClub
    ? [
        {
          key: "club",
          playerIds: participantPlayerIds,
          teamGoals: match.ourGoals ?? null,
        },
      ]
    : [
        {
          key: "a",
          playerIds: match.matchTeams?.teamA ?? [],
          teamGoals: match.teamAGoals ?? null,
        },
        {
          key: "b",
          playerIds: match.matchTeams?.teamB ?? [],
          teamGoals: match.teamBGoals ?? null,
        },
      ];

  return statsSubmissionState({
    participantPlayerIds,
    reports,
    sides,
    acknowledged: match.statsAcknowledged,
    consistencyIsWarning: isClub,
  });
}
