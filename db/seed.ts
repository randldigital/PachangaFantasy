import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { users, leagues, players, matches, matchParticipants } from "@shared/schema";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

const DEMO_EMAIL = "carlos@pachanga.test";
const DEMO_PASSWORD = "pachanga123";

async function seed() {
  const existing = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing.length > 0) {
    console.log(`Demo already seeded (${DEMO_EMAIL}). Skipping.`);
    return;
  }

  console.log("Seeding amateur demo league...");

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [owner] = await db.insert(users).values({
    username: "carlos",
    email: DEMO_EMAIL,
    password,
    role: "player",
  }).returning();

  const members = await db.insert(users).values([
    { username: "lucia", email: "lucia@pachanga.test", password, role: "player" },
    { username: "miguel", email: "miguel@pachanga.test", password, role: "player" },
    { username: "ana", email: "ana@pachanga.test", password, role: "player" },
  ]).returning();

  const participantIds = [owner.id, ...members.map((member) => member.id)];

  const [league] = await db.insert(leagues).values({
    name: "Pachanga del Parque",
    description: "Sunday kickabout with friends",
    inviteCode: nanoid(6).toUpperCase(),
    createdBy: owner.id,
    participants: participantIds,
    status: "closed",
  }).returning();

  const registeredPlayers = [
    { user: owner, name: "Carlos", value: 24 },
    { user: members[0], name: "Lucia", value: 18 },
    { user: members[1], name: "Miguel", value: 18 },
    { user: members[2], name: "Ana", value: 12 },
  ];

  const createdPlayers = [];
  for (const entry of registeredPlayers) {
    const [player] = await db.insert(players).values({
      name: entry.name,
      leagueId: league.id,
      userId: entry.user.id,
      createdBy: owner.id,
      emoji: "⚽",
      marketValue: entry.value,
    }).returning();
    createdPlayers.push(player);
  }

  const [elVecino] = await db.insert(players).values({
    name: "El Vecino",
    leagueId: league.id,
    createdBy: owner.id,
    isExternal: true,
    emoji: "🧢",
    marketValue: 12,
  }).returning();

  const [primo] = await db.insert(players).values({
    name: "Primo",
    leagueId: league.id,
    createdBy: owner.id,
    isExternal: true,
    emoji: "👟",
    marketValue: 8,
  }).returning();

  const kickoff = new Date();
  kickoff.setDate(kickoff.getDate() + 2);

  const [match] = await db.insert(matches).values({
    leagueId: league.id,
    date: kickoff,
    lineupBudget: 100,
    status: "open",
    createdBy: owner.id,
  }).returning();

  for (const player of [...createdPlayers, elVecino, primo]) {
    await db.insert(matchParticipants).values({
      matchId: match.id,
      playerId: player.id,
      status: "accepted",
    });
  }

  console.log(`
Demo league ready.

Owner:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}
Members: lucia@, miguel@, ana@pachanga.test / ${DEMO_PASSWORD}
League:  ${league.name} (invite ${league.inviteCode})
State:   Valuation closed with Market Values. One Open match, 4 members + 2 guests already joined.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed };
