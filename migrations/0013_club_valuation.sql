-- Club Mode valuation: clubs carry the same voting status and scoring baseline as leagues.
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "scoring_baseline" double precision NOT NULL DEFAULT 5;--> statement-breakpoint

-- A tier list belongs to exactly one context (league XOR club).
ALTER TABLE "tier_lists" ADD COLUMN IF NOT EXISTS "club_id" integer;--> statement-breakpoint
ALTER TABLE "tier_lists" ALTER COLUMN "league_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tier_lists" DROP CONSTRAINT IF EXISTS "tier_lists_league_xor_club";--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_league_xor_club"
	CHECK (("league_id" IS NULL) <> ("club_id" IS NULL));
