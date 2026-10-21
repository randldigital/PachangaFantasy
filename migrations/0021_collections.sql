ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_version" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "collections" (
  "id" serial PRIMARY KEY,
  "league_id" integer REFERENCES "leagues"("id") ON DELETE CASCADE,
  "club_id" integer REFERENCES "clubs"("id") ON DELETE CASCADE,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "collections_league_xor_club" CHECK (("league_id" IS NULL) <> ("club_id" IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "collections_league_unique" ON "collections" ("league_id") WHERE "league_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "collections_club_unique" ON "collections" ("club_id") WHERE "club_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "collection_cards" (
  "id" serial PRIMARY KEY,
  "collection_id" integer NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "source_key" text NOT NULL,
  "card_type" text NOT NULL,
  "rarity" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "player_id" integer REFERENCES "players"("id") ON DELETE SET NULL,
  "match_id" integer REFERENCES "matches"("id") ON DELETE SET NULL,
  "season_key" text,
  "occurred_at" timestamp NOT NULL,
  "period_key" text,
  "sort_rank" integer NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "title" text,
  "subtitle" text,
  "body" text,
  "image_path" text,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "collection_cards_status" CHECK ("status" IN ('active', 'error', 'retired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "collection_cards_source" ON "collection_cards" ("collection_id", "source_key");
CREATE INDEX IF NOT EXISTS "collection_cards_pack" ON "collection_cards" ("collection_id", "status", "rarity");
CREATE INDEX IF NOT EXISTS "collection_cards_album" ON "collection_cards" ("collection_id", "sort_rank", "occurred_at", "id");

CREATE TABLE IF NOT EXISTS "collection_ownership" (
  "collection_id" integer NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "card_id" integer NOT NULL REFERENCES "collection_cards"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL,
  "first_acquired_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "card_id"),
  CONSTRAINT "collection_ownership_quantity" CHECK ("quantity" >= 1)
);

CREATE TABLE IF NOT EXISTS "collection_pack_state" (
  "collection_id" integer NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "next_pack_at" timestamp,
  PRIMARY KEY ("collection_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "collection_pack_openings" (
  "id" serial PRIMARY KEY,
  "collection_id" integer NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opened_at" timestamp NOT NULL DEFAULT now(),
  "card_ids" integer[] NOT NULL,
  "rarities" text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS "collection_periods" (
  "collection_id" integer NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "period_key" text NOT NULL,
  "generated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("collection_id", "period_key")
);
