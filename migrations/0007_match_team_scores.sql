ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "team_a_goals" integer;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "team_b_goals" integer;
