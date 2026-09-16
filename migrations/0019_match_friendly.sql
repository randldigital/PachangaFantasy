ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "is_friendly" boolean NOT NULL DEFAULT false;
