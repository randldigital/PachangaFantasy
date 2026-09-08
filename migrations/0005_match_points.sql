CREATE TABLE IF NOT EXISTS "player_match_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manager_match_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"player_ids" integer[],
	"captain_id" integer,
	"points" integer NOT NULL,
	"lineup_status" text DEFAULT 'ok' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "player_match_points" ("player_id", "match_id", "goals", "assists", "points")
SELECT p."id", s."match_id", COALESCE(sr."goals", 0), COALESCE(sr."assists", 0), s."points"
FROM "scores" s
INNER JOIN "matches" m ON m."id" = s."match_id"
INNER JOIN "players" p ON p."user_id" = s."user_id" AND p."league_id" = m."league_id"
LEFT JOIN "stat_reports" sr ON sr."match_id" = s."match_id" AND sr."player_id" = p."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "player_match_points" existing
  WHERE existing."match_id" = s."match_id" AND existing."player_id" = p."id"
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_match_points" ADD CONSTRAINT "player_match_points_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_match_points" ADD CONSTRAINT "player_match_points_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "manager_match_points" ADD CONSTRAINT "manager_match_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "manager_match_points" ADD CONSTRAINT "manager_match_points_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_match_points_match_player" ON "player_match_points" ("match_id","player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manager_match_points_match_user" ON "manager_match_points" ("match_id","user_id");
--> statement-breakpoint
DROP TABLE IF EXISTS "scores";
