import { db } from "../server/db";
import { users, leagues, players } from "@shared/schema";
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const [adminUser] = await db.insert(users).values({
      username: 'admin',
      email: 'admin@pachanga.com',
      password: hashedPassword,
      role: 'admin',
    }).returning();

    console.log("✅ Created admin user");

    // Create sample players
    const [player1] = await db.insert(users).values({
      username: 'player1',
      email: 'player1@pachanga.com',
      password: await bcrypt.hash('player123', 10),
      role: 'player',
    }).returning();

    const [player2] = await db.insert(users).values({
      username: 'player2',
      email: 'player2@pachanga.com',
      password: await bcrypt.hash('player123', 10),
      role: 'player',
    }).returning();

    console.log("✅ Created sample players");

    // Create demo league
    const [league] = await db.insert(leagues).values({
      name: 'Liga Pachanga Demo',
      description: 'Demo league for testing the Pachanga Fantasy app',
      inviteCode: nanoid(6).toUpperCase(),
      createdBy: adminUser.id,
      participants: [adminUser.id, player1.id, player2.id],
      status: 'open',
    }).returning();

    console.log("✅ Created demo league");

    // Add participants to league_participants table
    await db.execute(sql`
      INSERT INTO league_participants (user_id, league_id)
      VALUES 
        (${adminUser.id}, ${league.id}),
        (${player1.id}, ${league.id}),
        (${player2.id}, ${league.id})
      ON CONFLICT (user_id, league_id) DO NOTHING;
    `);

    console.log("✅ Added participants to league");

    // Create sample players for the league
    const playerNames = [
      { name: 'Lionel Messi', position: 'Forward', emoji: '🐐' },
      { name: 'Cristiano Ronaldo', position: 'Forward', emoji: '👑' },
      { name: 'Neymar Jr', position: 'Forward', emoji: '🇧🇷' },
      { name: 'Kylian Mbappé', position: 'Forward', emoji: '⚡' },
      { name: 'Erling Haaland', position: 'Forward', emoji: '🤖' },
      { name: 'Kevin De Bruyne', position: 'Midfielder', emoji: '🎯' },
      { name: 'Virgil van Dijk', position: 'Defender', emoji: '🗿' },
      { name: 'Alisson Becker', position: 'Goalkeeper', emoji: '🧤' },
    ];

    for (const player of playerNames) {
      await db.insert(players).values({
        name: player.name,
        position: player.position,
        emoji: player.emoji,
        leagueId: league.id,
        marketValue: Math.floor(Math.random() * 50) + 10, // Random value between 10-60
      });
    }

    console.log("✅ Created sample players");

    console.log(`
🎉 Database seeded successfully!

Demo credentials:
📧 Admin: admin@pachanga.com / admin123
📧 Player 1: player1@pachanga.com / player123  
📧 Player 2: player2@pachanga.com / player123

🏆 Demo League: "${league.name}" (Code: ${league.inviteCode})
    `);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seed };