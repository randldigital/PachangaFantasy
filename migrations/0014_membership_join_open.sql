ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "join_open" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "join_open" boolean NOT NULL DEFAULT true;
