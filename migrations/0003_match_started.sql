ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'open';
UPDATE "matches" SET "status" = 'started' WHERE "status" = 'ready';
