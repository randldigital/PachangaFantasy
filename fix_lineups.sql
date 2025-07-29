-- Fix malformed player_ids in lineups table
-- This script will convert any non-array values to proper integer arrays

-- First, let's see what we have
SELECT id, user_id, match_id, player_ids, pg_typeof(player_ids) FROM lineups;

-- Check if there are any rows where player_ids is not an array
-- For integer[] columns, we need to check if the value is actually an array
SELECT id, user_id, match_id, player_ids, pg_typeof(player_ids) 
FROM lineups 
WHERE array_length(player_ids, 1) IS NULL OR array_length(player_ids, 1) = 0;

-- If there are malformed rows, we need to fix them
-- This will wrap single integers in arrays
UPDATE lineups 
SET player_ids = ARRAY[player_ids::text::int]
WHERE array_length(player_ids, 1) IS NULL;

-- Verify the fix
SELECT id, user_id, match_id, player_ids, pg_typeof(player_ids) FROM lineups; 