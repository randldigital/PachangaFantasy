-- Debug the manager leaderboard issue step by step

-- Step 1: Check matches in league 1
SELECT 'Step 1 - Matches in league 1' as step;
SELECT id, league_id, status FROM matches WHERE league_id = 1;

-- Step 2: Check lineups for those matches
SELECT 'Step 2 - Lineups for matches' as step;
SELECT id, user_id, match_id, player_ids, pg_typeof(player_ids) 
FROM lineups 
WHERE match_id IN (SELECT id FROM matches WHERE league_id = 1);

-- Step 3: Check if there are any issues with the match_id values
SELECT 'Step 3 - Check match_id types' as step;
SELECT DISTINCT pg_typeof(match_id) FROM lineups;

-- Step 4: Check if there are any string values in numeric columns
SELECT 'Step 4 - Check for string values in numeric columns' as step;
SELECT id, user_id, match_id, 
       CASE WHEN user_id::text ~ '^[0-9]+$' THEN 'valid' ELSE 'string' END as user_id_status,
       CASE WHEN match_id::text ~ '^[0-9]+$' THEN 'valid' ELSE 'string' END as match_id_status
FROM lineups; 