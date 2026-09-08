ALTER TABLE "tier_lists" ADD COLUMN IF NOT EXISTS "player_tiers" jsonb DEFAULT '[]'::jsonb;
UPDATE "tier_lists" SET "player_tiers" = '[]'::jsonb WHERE "player_tiers" IS NULL;
ALTER TABLE "tier_lists" ALTER COLUMN "player_tiers" SET NOT NULL;
ALTER TABLE "tier_lists" DROP COLUMN IF EXISTS "player_order";
