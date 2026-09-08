ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "stats_acknowledged" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "stat_reports" ADD COLUMN IF NOT EXISTS "player_id" integer;
--> statement-breakpoint
UPDATE "stat_reports" AS sr
SET "player_id" = p."id"
FROM "players" AS p, "matches" AS m
WHERE sr."match_id" = m."id"
  AND sr."player_id" IS NULL
  AND p."user_id" = sr."user_id"
  AND p."league_id" = m."league_id";
--> statement-breakpoint
DELETE FROM "stat_reports" WHERE "player_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "stat_reports" ALTER COLUMN "player_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "stat_reports" DROP CONSTRAINT IF EXISTS "stat_reports_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "stat_reports" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stat_reports" ADD CONSTRAINT "stat_reports_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stat_reports_match_player" ON "stat_reports" ("match_id","player_id");
