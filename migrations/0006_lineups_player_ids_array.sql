-- Live databases created before the shared schema used jsonb for lineup player ids.
-- Drizzle/postgres-js serializes JS arrays as integer[], which Postgres then rejects
-- as invalid JSON. Convert the column so saves match the rest of the schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'lineups'
      AND column_name = 'player_ids'
      AND data_type IN ('json', 'jsonb')
  ) THEN
    ALTER TABLE "lineups"
      ALTER COLUMN "player_ids" TYPE integer[]
      USING translate("player_ids"::text, '[]', '{}')::integer[];
  END IF;
END $$;
