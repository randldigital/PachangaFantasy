-- Club Mode: a Club is a sibling of a League, and every Player/Match belongs to exactly one.
CREATE TABLE IF NOT EXISTS "clubs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"invite_code" text NOT NULL,
	"created_by" integer NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "clubs_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "club_id" integer;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "league_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "players_league_xor_club";--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_league_xor_club"
	CHECK (("league_id" IS NULL) <> ("club_id" IS NULL));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_club" ON "players" ("club_id");--> statement-breakpoint

ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "club_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "opponent_name" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "our_goals" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "opponent_goals" integer;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "league_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_club_id_clubs_id_fk";--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_club_id_clubs_id_fk"
	FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_league_xor_club";--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_league_xor_club"
	CHECK (("league_id" IS NULL) <> ("club_id" IS NULL));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_club_season" ON "matches" ("club_id","season_key");--> statement-breakpoint

-- Club stat reports carry minutes played; Fantasy rows leave it null.
ALTER TABLE "stat_reports" ADD COLUMN IF NOT EXISTS "minutes" integer;--> statement-breakpoint
ALTER TABLE "stat_reports" DROP CONSTRAINT IF EXISTS "stat_reports_minutes_range";--> statement-breakpoint
ALTER TABLE "stat_reports" ADD CONSTRAINT "stat_reports_minutes_range"
	CHECK ("minutes" IS NULL OR ("minutes" >= 0 AND "minutes" <= 120));
