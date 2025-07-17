import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migration utilities for Pachanga Fantasy database
 * This helps transition from the basic schema to the comprehensive schema
 */

async function createExtendedTables() {
  console.log("🔄 Creating extended tables for match system...");

  try {
    // Create league_participants table (normalized from participants jsonb)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS league_participants (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, league_id)
      );
    `);

    // Create matches table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL,
        status TEXT CHECK (status IN ('open', 'closed', 'completed')) DEFAULT 'open',
        lineup_budget INTEGER DEFAULT 100,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create match_participants table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS match_participants (
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT CHECK (status IN ('accepted', 'declined', 'pending')) DEFAULT 'pending',
        PRIMARY KEY (match_id, user_id)
      );
    `);

    // Create lineups table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lineups (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player_ids JSONB NOT NULL,
        total_cost INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create stat_reports table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stat_reports (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goals INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create votes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mvps JSONB NOT NULL,
        flops JSONB NOT NULL,
        submitted_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create scores table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scores (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        points INTEGER DEFAULT 0,
        calculated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, match_id)
      );
    `);

    console.log("✅ Extended tables created successfully");

    // Migrate existing league participants from jsonb to normalized table
    await db.execute(sql`
      INSERT INTO league_participants (user_id, league_id)
      SELECT unnest(participants::integer[]) as user_id, id as league_id
      FROM leagues
      WHERE participants IS NOT NULL
      ON CONFLICT (user_id, league_id) DO NOTHING;
    `);

    console.log("✅ Migrated existing league participants");

  } catch (error) {
    console.error("❌ Error creating extended tables:", error);
    throw error;
  }
}

async function addIndexes() {
  console.log("🔍 Adding database indexes for performance...");

  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_players_league_id ON players(league_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tier_lists_league_user ON tier_lists(league_id, user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_matches_league_status ON matches(league_id, status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lineups_match_user ON lineups(match_id, user_id);`);
    
    console.log("✅ Database indexes added");
  } catch (error) {
    console.error("❌ Error adding indexes:", error);
    throw error;
  }
}

async function getSchemaInfo() {
  console.log("📊 Database Schema Information:");
  
  try {
    const tables = await db.execute(sql`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.table(tables.rows);

    const totalRows = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM leagues) as leagues,
        (SELECT COUNT(*) FROM players) as players,
        (SELECT COUNT(*) FROM tier_lists) as tier_lists;
    `);

    console.log("📈 Row counts:", totalRows.rows[0]);

  } catch (error) {
    console.error("❌ Error getting schema info:", error);
  }
}

// CLI commands
const command = process.argv[2];

switch (command) {
  case 'extend':
    createExtendedTables()
      .then(() => console.log('✅ Extended schema migration complete'))
      .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      });
    break;
    
  case 'indexes':
    addIndexes()
      .then(() => console.log('✅ Index creation complete'))
      .catch((error) => {
        console.error('❌ Index creation failed:', error);
        process.exit(1);
      });
    break;
    
  case 'info':
    getSchemaInfo()
      .catch((error) => {
        console.error('❌ Schema info failed:', error);
        process.exit(1);
      });
    break;
    
  default:
    console.log(`
📚 Available commands:
  tsx db/migrate.ts extend  - Create extended tables for match system
  tsx db/migrate.ts indexes - Add performance indexes
  tsx db/migrate.ts info    - Show schema information
    `);
}

export { createExtendedTables, addIndexes, getSchemaInfo };