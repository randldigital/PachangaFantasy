import postgres from "postgres";

const TEST_SCHEMA = process.env.TEST_SCHEMA || "pachanga_test";

function databaseUrl() {
  return (
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://pachanga_user:admin@localhost:5432/pachanga"
  );
}

function assertSafeSchemaName(name: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe test schema name: ${name}`);
  }
}

function testClient() {
  assertSafeSchemaName(TEST_SCHEMA);
  return postgres(databaseUrl(), {
    max: 1,
    onnotice: () => {},
    connection: { options: `-c search_path=${TEST_SCHEMA}` },
  });
}

export async function ensureTestDatabase() {
  assertSafeSchemaName(TEST_SCHEMA);
  const admin = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
  } finally {
    await admin.end();
  }
}

export async function resetTestSchema() {
  const client = testClient();

  const rows = await client`SELECT current_schema() AS schema`;
  const schemaName = rows[0]?.schema;
  if (schemaName !== TEST_SCHEMA) {
    await client.end();
    throw new Error(
      `Refusing to reset tables: current_schema is "${schemaName}", expected "${TEST_SCHEMA}"`,
    );
  }

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      username text NOT NULL UNIQUE,
      email text NOT NULL UNIQUE,
      password text NOT NULL,
      role text NOT NULL DEFAULT 'player',
      league_id integer
    );
    CREATE TABLE IF NOT EXISTS leagues (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text DEFAULT '',
      invite_code text NOT NULL UNIQUE,
      created_by integer NOT NULL,
      status text NOT NULL DEFAULT 'open',
      participants jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS players (
      id serial PRIMARY KEY,
      name text NOT NULL,
      league_id integer NOT NULL,
      market_value integer DEFAULT 0,
      emoji text NOT NULL DEFAULT '⚽',
      is_external boolean DEFAULT false,
      created_by integer,
      user_id integer,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tier_lists (
      id serial PRIMARY KEY,
      league_id integer NOT NULL,
      user_id integer NOT NULL,
      player_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
      submitted boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS matches (
      id serial PRIMARY KEY,
      league_id integer NOT NULL,
      date timestamp NOT NULL,
      lineup_budget integer DEFAULT 100,
      status text DEFAULT 'open',
      match_teams json,
      final_score integer,
      stats_acknowledged boolean NOT NULL DEFAULT false,
      created_by integer NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS match_participants (
      match_id integer NOT NULL,
      player_id integer NOT NULL,
      user_id integer,
      status text NOT NULL DEFAULT 'pending',
      PRIMARY KEY (match_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS lineups (
      id serial PRIMARY KEY,
      match_id integer NOT NULL,
      user_id integer NOT NULL,
      player_ids integer[] NOT NULL,
      captain_id integer NOT NULL,
      total_cost integer NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS stat_reports (
      id serial PRIMARY KEY,
      player_id integer NOT NULL,
      match_id integer NOT NULL,
      goals integer DEFAULT 0,
      assists integer DEFAULT 0,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS player_match_points (
      id serial PRIMARY KEY,
      player_id integer NOT NULL,
      match_id integer NOT NULL,
      goals integer DEFAULT 0 NOT NULL,
      assists integer DEFAULT 0 NOT NULL,
      points integer NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS manager_match_points (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      match_id integer NOT NULL,
      player_ids integer[],
      captain_id integer,
      points integer NOT NULL,
      lineup_status text DEFAULT 'ok' NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS scores (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      match_id integer NOT NULL,
      points integer NOT NULL,
      created_at timestamp DEFAULT now()
    );
  `);

  await client.unsafe(`ALTER TABLE players DROP COLUMN IF EXISTS position`);
  await client.unsafe(`ALTER TABLE tier_lists ADD COLUMN IF NOT EXISTS player_tiers jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await client.unsafe(`ALTER TABLE tier_lists DROP COLUMN IF EXISTS player_order`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS stats_acknowledged boolean NOT NULL DEFAULT false`);
  await client.unsafe(`ALTER TABLE stat_reports ADD COLUMN IF NOT EXISTS player_id integer`);
  await client.unsafe(`
    DO $lineup$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'lineups'
          AND column_name = 'player_ids'
          AND data_type IN ('json', 'jsonb')
      ) THEN
        ALTER TABLE lineups
          ALTER COLUMN player_ids TYPE integer[]
          USING translate(player_ids::text, '[]', '{}')::integer[];
      END IF;
    END
    $lineup$;
  `);

  const hasStatUserId = await client`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'stat_reports'
      AND column_name = 'user_id'
  `;
  if (hasStatUserId.length > 0) {
    await client.unsafe(`DELETE FROM stat_reports`);
    await client.unsafe(`ALTER TABLE stat_reports DROP COLUMN IF EXISTS user_id`);
  }

  await client.unsafe(`DELETE FROM stat_reports WHERE player_id IS NULL`);
  await client.unsafe(`ALTER TABLE stat_reports ALTER COLUMN player_id SET NOT NULL`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS stat_reports_match_player ON stat_reports (match_id, player_id)`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS player_match_points_match_player ON player_match_points (match_id, player_id)`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS manager_match_points_match_user ON manager_match_points (match_id, user_id)`);

  await client.unsafe(`
    TRUNCATE TABLE
      manager_match_points,
      player_match_points,
      scores,
      stat_reports,
      lineups,
      match_participants,
      matches,
      tier_lists,
      players,
      leagues,
      users
    RESTART IDENTITY CASCADE
  `);

  await client.end();
}

