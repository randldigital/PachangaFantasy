-- Check the actual database schema for lineups table
\d lineups

-- Check the data type of player_ids column
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lineups' AND column_name = 'player_ids';

-- Check current data
SELECT id, user_id, match_id, player_ids, pg_typeof(player_ids) FROM lineups; 