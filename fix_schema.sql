-- Fix schema mismatch: convert player_ids from integer[] to jsonb
-- This will align the database schema with the code schema

-- First, check current schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lineups' AND column_name = 'player_ids';

-- Convert integer[] to jsonb
-- Convert Postgres array format {1,2,3} to JSONB format [1,2,3]
ALTER TABLE lineups 
ALTER COLUMN player_ids TYPE jsonb USING 
  replace(replace(player_ids::text, '{', '['), '}', ']')::jsonb;

-- Verify the conversion
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lineups' AND column_name = 'player_ids';

-- Check the data after conversion
SELECT id, user_id, match_id, player_ids, pg_typeof(player_ids) FROM lineups; 