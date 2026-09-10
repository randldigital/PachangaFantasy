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
      league_id integer,
      avatar_path text
    );
    CREATE TABLE IF NOT EXISTS leagues (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text DEFAULT '',
      invite_code text NOT NULL UNIQUE,
      created_by integer NOT NULL,
      status text NOT NULL DEFAULT 'open',
      participants jsonb NOT NULL DEFAULT '[]'::jsonb,
      scoring_baseline double precision NOT NULL DEFAULT 5,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS clubs (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text DEFAULT '',
      invite_code text NOT NULL UNIQUE,
      created_by integer NOT NULL,
      status text NOT NULL DEFAULT 'open',
      participants jsonb NOT NULL DEFAULT '[]'::jsonb,
      scoring_baseline double precision NOT NULL DEFAULT 5,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS players (
      id serial PRIMARY KEY,
      name text NOT NULL,
      league_id integer,
      club_id integer,
      market_value integer DEFAULT 0,
      emoji text NOT NULL DEFAULT '⚽',
      is_external boolean DEFAULT false,
      created_by integer,
      user_id integer,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tier_lists (
      id serial PRIMARY KEY,
      league_id integer,
      club_id integer,
      user_id integer NOT NULL,
      player_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
      submitted boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS matches (
      id serial PRIMARY KEY,
      league_id integer,
      club_id integer,
      date timestamp NOT NULL,
      lineup_budget integer DEFAULT 100,
      side_size integer NOT NULL DEFAULT 5,
      status text DEFAULT 'open',
      match_teams json,
      final_score integer,
      team_a_goals integer,
      team_b_goals integer,
      opponent_name text,
      our_goals integer,
      opponent_goals integer,
      stats_acknowledged boolean NOT NULL DEFAULT false,
      created_by integer NOT NULL,
      season_key text,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS player_claim_requests (
      id serial PRIMARY KEY,
      player_id integer NOT NULL,
      user_id integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamp DEFAULT now(),
      resolved_at timestamp,
      resolved_by integer
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
      minutes integer,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS player_match_points (
      id serial PRIMARY KEY,
      player_id integer NOT NULL,
      match_id integer NOT NULL,
      goals integer DEFAULT 0 NOT NULL,
      assists integer DEFAULT 0 NOT NULL,
      points double precision NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS manager_match_points (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      match_id integer NOT NULL,
      player_ids integer[],
      captain_id integer,
      points double precision NOT NULL,
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
    CREATE TABLE IF NOT EXISTS match_player_vm (
      match_id integer NOT NULL,
      player_id integer NOT NULL,
      market_value integer NOT NULL,
      PRIMARY KEY (match_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS match_rating_assignments (
      match_id integer NOT NULL,
      rater_player_id integer NOT NULL,
      ratee_player_id integer NOT NULL,
      kind text NOT NULL,
      PRIMARY KEY (match_id, rater_player_id, ratee_player_id)
    );
    CREATE TABLE IF NOT EXISTS match_mvp_votes (
      match_id integer NOT NULL,
      voter_player_id integer NOT NULL,
      mvp_player_id integer NOT NULL,
      PRIMARY KEY (match_id, voter_player_id)
    );
    CREATE TABLE IF NOT EXISTS match_peer_ratings (
      match_id integer NOT NULL,
      rater_player_id integer NOT NULL,
      ratee_player_id integer NOT NULL,
      score double precision NOT NULL,
      PRIMARY KEY (match_id, rater_player_id, ratee_player_id)
    );
    CREATE TABLE IF NOT EXISTS player_market_value_history (
      id serial PRIMARY KEY,
      match_id integer NOT NULL,
      player_id integer NOT NULL,
      vm_before integer NOT NULL,
      vm_after integer NOT NULL,
      delta integer NOT NULL,
      mvp double precision NOT NULL,
      peer double precision NOT NULL,
      offensive double precision NOT NULL,
      result double precision NOT NULL,
      performance_score double precision NOT NULL,
      raw_change double precision NOT NULL,
      multiplier double precision NOT NULL,
      adjusted_contribution double precision NOT NULL,
      expected_contribution double precision NOT NULL,
      baseline double precision NOT NULL,
      own_team_avg_vm double precision NOT NULL,
      opp_team_avg_vm double precision NOT NULL,
      mvp_votes integer NOT NULL DEFAULT 0,
      peer_average double precision,
      breakdown jsonb NOT NULL,
      created_at timestamp DEFAULT now()
    );
  `);

  await client.unsafe(`ALTER TABLE players DROP COLUMN IF EXISTS position`);
  await client.unsafe(`ALTER TABLE tier_lists ADD COLUMN IF NOT EXISTS player_tiers jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await client.unsafe(`ALTER TABLE tier_lists DROP COLUMN IF EXISTS player_order`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS stats_acknowledged boolean NOT NULL DEFAULT false`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_goals integer`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_goals integer`);
  await client.unsafe(`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS scoring_baseline double precision NOT NULL DEFAULT 5`);
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
  await client.unsafe(`ALTER TABLE player_match_points ALTER COLUMN points TYPE double precision USING points::double precision`);
  await client.unsafe(`ALTER TABLE manager_match_points ALTER COLUMN points TYPE double precision USING points::double precision`);
  await client.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path text`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_key text`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS side_size integer NOT NULL DEFAULT 5`);
  await client.unsafe(`ALTER TABLE leagues ALTER COLUMN invite_code TYPE text`);
  await client.unsafe(`ALTER TABLE players ADD COLUMN IF NOT EXISTS club_id integer`);
  await client.unsafe(`ALTER TABLE players ALTER COLUMN league_id DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS club_id integer`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_name text`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS our_goals integer`);
  await client.unsafe(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_goals integer`);
  await client.unsafe(`ALTER TABLE matches ALTER COLUMN league_id DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE stat_reports ADD COLUMN IF NOT EXISTS minutes integer`);
  await client.unsafe(`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'`);
  await client.unsafe(`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS scoring_baseline double precision NOT NULL DEFAULT 5`);
  await client.unsafe(`ALTER TABLE tier_lists ADD COLUMN IF NOT EXISTS club_id integer`);
  await client.unsafe(`ALTER TABLE tier_lists ALTER COLUMN league_id DROP NOT NULL`);
  await client.unsafe(`ALTER TABLE players DROP CONSTRAINT IF EXISTS players_league_xor_club`);
  await client.unsafe(`ALTER TABLE players ADD CONSTRAINT players_league_xor_club CHECK ((league_id IS NULL) <> (club_id IS NULL))`);
  await client.unsafe(`ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_league_xor_club`);
  await client.unsafe(`ALTER TABLE matches ADD CONSTRAINT matches_league_xor_club CHECK ((league_id IS NULL) <> (club_id IS NULL))`);
  await client.unsafe(`ALTER TABLE tier_lists DROP CONSTRAINT IF EXISTS tier_lists_league_xor_club`);
  await client.unsafe(`ALTER TABLE tier_lists ADD CONSTRAINT tier_lists_league_xor_club CHECK ((league_id IS NULL) <> (club_id IS NULL))`);
  await client.unsafe(`ALTER TABLE stat_reports DROP CONSTRAINT IF EXISTS stat_reports_minutes_range`);
  await client.unsafe(`ALTER TABLE stat_reports ADD CONSTRAINT stat_reports_minutes_range CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 120))`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS matches_league_season ON matches (league_id, season_key)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS matches_club_season ON matches (club_id, season_key)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS players_club ON players (club_id)`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS player_claim_requests_pending_pair ON player_claim_requests (player_id, user_id) WHERE status = 'pending'`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS stat_reports_match_player ON stat_reports (match_id, player_id)`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS player_match_points_match_player ON player_match_points (match_id, player_id)`);
  await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS player_market_value_history_match_player ON player_market_value_history (match_id, player_id)`);

  await client.unsafe(`
    TRUNCATE TABLE
      player_market_value_history,
      match_peer_ratings,
      match_mvp_votes,
      match_rating_assignments,
      match_player_vm,
      manager_match_points,
      player_match_points,
      scores,
      stat_reports,
      lineups,
      match_participants,
      matches,
      tier_lists,
      player_claim_requests,
      players,
      leagues,
      clubs,
      users
    RESTART IDENTITY CASCADE
  `);

  await client.end();
}

