-- Check all tables for potential array/JSONB issues

-- Check lineups table
SELECT 'lineups' as table_name, id, user_id, match_id, player_ids, pg_typeof(player_ids) 
FROM lineups;

-- Check matches table (if it has any array columns)
SELECT 'matches' as table_name, id, league_id, pg_typeof(id) 
FROM matches LIMIT 5;

-- Check if there are any other tables with array columns
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE data_type LIKE '%ARRAY%' OR data_type = 'jsonb'
ORDER BY table_name, column_name;

-- Check for any malformed data in lineups
SELECT id, user_id, match_id, player_ids, 
       CASE 
         WHEN jsonb_typeof(player_ids) = 'array' THEN 'valid'
         ELSE 'malformed'
       END as status
FROM lineups; 