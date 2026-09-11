import { clubs, type Club, type InsertClub } from "@shared/schema";
import { db } from "../db";
import { eq, or, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { buildInviteCode, INVITE_ALPHABET, INVITE_BODY_LENGTH } from "@shared/domain/inviteCodes";
import * as billingRepo from "./billingRepo";
import * as matchRepo from "./matchRepo";
import * as playerRepo from "./playerRepo";
import * as valuationRepo from "./valuationRepo";

const inviteBody = customAlphabet(INVITE_ALPHABET, INVITE_BODY_LENGTH);

export async function getClub(id: number): Promise<Club | undefined> {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
  return club || undefined;
}

export async function getClubByInviteCode(inviteCode: string): Promise<Club | undefined> {
  const [club] = await db.select().from(clubs).where(eq(clubs.inviteCode, inviteCode));
  return club || undefined;
}

export async function createClub(club: InsertClub, createdBy: number): Promise<Club> {
  const [created] = await db
    .insert(clubs)
    .values({
      name: club.name,
      description: club.description,
      inviteCode: buildInviteCode("club", inviteBody()),
      createdBy,
      participants: [createdBy],
      createdAt: new Date(),
    })
    .returning();
  await billingRepo.ensureBillingAccount({ type: "club", id: created.id });
  return created;
}

export async function updateClub(id: number, updates: Partial<Club>): Promise<Club | undefined> {
  const [updated] = await db.update(clubs).set(updates).where(eq(clubs.id, id)).returning();
  return updated || undefined;
}

export async function deleteClub(id: number): Promise<void> {
  const clubMatches = await matchRepo.getMatchesByClub(id);
  for (const match of clubMatches) {
    await matchRepo.deleteMatch(match.id);
  }
  await playerRepo.deletePlayersByClub(id);
  await valuationRepo.deleteTierListsByClub(id);
  await billingRepo.deleteAccount({ type: "club", id });
  await db.delete(clubs).where(eq(clubs.id, id));
}

export async function getUserClubs(userId: number): Promise<Club[]> {
  return await db.select().from(clubs).where(
    or(
      eq(clubs.createdBy, userId),
      sql`${clubs.participants} @> ${JSON.stringify([userId])}`,
    ),
  );
}
