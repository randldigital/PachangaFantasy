ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_path" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_claim_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolved_by" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_claim_requests_pending_pair" ON "player_claim_requests" ("player_id","user_id") WHERE status = 'pending';
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "season_key" text;
--> statement-breakpoint
UPDATE "matches"
SET "season_key" = CASE
	WHEN EXTRACT(MONTH FROM "date") >= 8
		THEN EXTRACT(YEAR FROM "date")::int || '/' || lpad((((EXTRACT(YEAR FROM "date")::int + 1) % 100))::text, 2, '0')
	ELSE (EXTRACT(YEAR FROM "date")::int - 1) || '/' || lpad(((EXTRACT(YEAR FROM "date")::int % 100))::text, 2, '0')
END
WHERE "season_key" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_league_season" ON "matches" ("league_id","season_key");
--> statement-breakpoint
ALTER TABLE "leagues" ALTER COLUMN "invite_code" TYPE text;
