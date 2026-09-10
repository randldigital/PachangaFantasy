ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "side_size" integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
UPDATE "matches" SET "side_size" = 5 WHERE "side_size" IS NULL OR "side_size" NOT IN (5, 7, 11);
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_side_size_allowed";
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_side_size_allowed" CHECK ("side_size" IN (5, 7, 11));
