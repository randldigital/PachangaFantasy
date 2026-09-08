ALTER TABLE "match_peer_ratings" ALTER COLUMN "score" TYPE double precision USING "score"::double precision;
--> statement-breakpoint
ALTER TABLE "player_match_points" ALTER COLUMN "points" TYPE double precision USING "points"::double precision;
--> statement-breakpoint
ALTER TABLE "manager_match_points" ALTER COLUMN "points" TYPE double precision USING "points"::double precision;
