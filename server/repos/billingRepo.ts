import { and, eq } from "drizzle-orm";
import {
  billingAccounts,
  clubs,
  leagues,
  payments,
  plans,
  subscriptions,
  type BillingAccount,
} from "@shared/schema";
import { db } from "../db";
import { defaultPlanCode } from "../env";

export type BillingSubjectType = "user" | "league" | "club";
export type BillingSubject = { type: BillingSubjectType; id: number };

export async function ensureCatalog(): Promise<void> {
  await db
    .insert(plans)
    .values([
      { code: "free", name: "Free" },
      { code: "plus", name: "Plus" },
    ])
    .onConflictDoNothing();
}

export async function getPlanByCode(code: string) {
  await ensureCatalog();
  const [plan] = await db.select().from(plans).where(eq(plans.code, code));
  return plan;
}

export async function findAccount(subject: BillingSubject): Promise<BillingAccount | undefined> {
  const [account] = await db
    .select()
    .from(billingAccounts)
    .where(
      and(
        eq(billingAccounts.subjectType, subject.type),
        eq(billingAccounts.subjectId, subject.id),
      ),
    );
  return account;
}

export async function ensureBillingAccount(subject: BillingSubject): Promise<BillingAccount> {
  await ensureCatalog();
  const existing = await findAccount(subject);
  if (existing) {
    await ensureActiveSubscription(existing.id);
    return existing;
  }

  const [created] = await db
    .insert(billingAccounts)
    .values({ subjectType: subject.type, subjectId: subject.id })
    .onConflictDoNothing()
    .returning();
  const account = created ?? (await findAccount(subject));
  if (!account) {
    throw new Error("Failed to create billing account");
  }
  await ensureActiveSubscription(account.id);
  return account;
}

async function ensureActiveSubscription(billingAccountId: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.billingAccountId, billingAccountId));
  if (existing) {
    return;
  }
  const free = await getPlanByCode(defaultPlanCode());
  if (!free) {
    throw new Error("Default plan is missing");
  }
  await db.insert(subscriptions).values({
    billingAccountId,
    planId: free.id,
    status: "active",
  });
}

export async function resolvePlan(subject: BillingSubject): Promise<string> {
  const account = await findAccount(subject);
  if (!account) {
    return defaultPlanCode();
  }
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.billingAccountId, account.id), eq(subscriptions.status, "active")),
    );
  if (!sub) {
    return defaultPlanCode();
  }
  const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId));
  return plan?.code ?? defaultPlanCode();
}

export async function getSubscriptionForAccount(billingAccountId: number) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.billingAccountId, billingAccountId));
  if (!sub) {
    return null;
  }
  const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId));
  return { subscription: sub, plan };
}

export async function setPlan(subject: BillingSubject, planCode: string): Promise<void> {
  const account = await ensureBillingAccount(subject);
  const plan = await getPlanByCode(planCode);
  if (!plan) {
    throw new Error(`Unknown plan ${planCode}`);
  }
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.billingAccountId, account.id));
  if (existing) {
    await db
      .update(subscriptions)
      .set({ planId: plan.id, status: "active" })
      .where(eq(subscriptions.id, existing.id));
    return;
  }
  await db.insert(subscriptions).values({
    billingAccountId: account.id,
    planId: plan.id,
    status: "active",
  });
}

export async function deleteAccount(subject: BillingSubject): Promise<void> {
  const account = await findAccount(subject);
  if (!account) {
    return;
  }
  await db.delete(payments).where(eq(payments.billingAccountId, account.id));
  await db.delete(subscriptions).where(eq(subscriptions.billingAccountId, account.id));
  await db.delete(billingAccounts).where(eq(billingAccounts.id, account.id));
}

export async function listAccountsForUser(userId: number) {
  const personal = await ensureBillingAccount({ type: "user", id: userId });
  const ownedLeagues = await db.select().from(leagues).where(eq(leagues.createdBy, userId));
  const memberLeagues = await db.select().from(leagues);
  const ownedClubs = await db.select().from(clubs).where(eq(clubs.createdBy, userId));
  const memberClubs = await db.select().from(clubs);

  const subjects: {
    subjectType: BillingSubjectType;
    subjectId: number;
    name: string;
    canManage: boolean;
    account: BillingAccount;
  }[] = [
    {
      subjectType: "user",
      subjectId: userId,
      name: "Personal",
      canManage: true,
      account: personal,
    },
  ];

  for (const league of memberLeagues) {
    const isMember =
      league.createdBy === userId || (league.participants || []).includes(userId);
    if (!isMember) continue;
    const account = await ensureBillingAccount({ type: "league", id: league.id });
    subjects.push({
      subjectType: "league",
      subjectId: league.id,
      name: league.name,
      canManage: ownedLeagues.some((row) => row.id === league.id),
      account,
    });
  }

  for (const club of memberClubs) {
    const isMember = club.createdBy === userId || (club.participants || []).includes(userId);
    if (!isMember) continue;
    const account = await ensureBillingAccount({ type: "club", id: club.id });
    subjects.push({
      subjectType: "club",
      subjectId: club.id,
      name: club.name,
      canManage: ownedClubs.some((row) => row.id === club.id),
      account,
    });
  }

  return subjects;
}

export async function canManageAccount(userId: number, account: BillingAccount): Promise<boolean> {
  if (account.subjectType === "user") {
    return account.subjectId === userId;
  }
  if (account.subjectType === "league") {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, account.subjectId));
    return Boolean(league && league.createdBy === userId);
  }
  const [club] = await db.select().from(clubs).where(eq(clubs.id, account.subjectId));
  return Boolean(club && club.createdBy === userId);
}

export async function isSubjectMember(userId: number, subject: BillingSubject): Promise<boolean> {
  if (subject.type === "user") {
    return subject.id === userId;
  }
  if (subject.type === "league") {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, subject.id));
    return Boolean(
      league && (league.createdBy === userId || (league.participants || []).includes(userId)),
    );
  }
  const [club] = await db.select().from(clubs).where(eq(clubs.id, subject.id));
  return Boolean(
    club && (club.createdBy === userId || (club.participants || []).includes(userId)),
  );
}

export async function getAccount(id: number): Promise<BillingAccount | undefined> {
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.id, id));
  return account;
}
