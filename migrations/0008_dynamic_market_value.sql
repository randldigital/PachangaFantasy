ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "scoring_baseline" double precision NOT NULL DEFAULT 5;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_player_vm" (
  "match_id" integer NOT NULL REFERENCES "matches"("id"),
  "player_id" integer NOT NULL REFERENCES "players"("id"),
  "market_value" integer NOT NULL,
  PRIMARY KEY ("match_id", "player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_rating_assignments" (
  "match_id" integer NOT NULL REFERENCES "matches"("id"),
  "rater_player_id" integer NOT NULL REFERENCES "players"("id"),
  "ratee_player_id" integer NOT NULL REFERENCES "players"("id"),
  "kind" text NOT NULL,
  PRIMARY KEY ("match_id", "rater_player_id", "ratee_player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_mvp_votes" (
  "match_id" integer NOT NULL REFERENCES "matches"("id"),
  "voter_player_id" integer NOT NULL REFERENCES "players"("id"),
  "mvp_player_id" integer NOT NULL REFERENCES "players"("id"),
  PRIMARY KEY ("match_id", "voter_player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_peer_ratings" (
  "match_id" integer NOT NULL REFERENCES "matches"("id"),
  "rater_player_id" integer NOT NULL REFERENCES "players"("id"),
  "ratee_player_id" integer NOT NULL REFERENCES "players"("id"),
  "score" integer NOT NULL,
  PRIMARY KEY ("match_id", "rater_player_id", "ratee_player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_market_value_history" (
  "id" serial PRIMARY KEY,
  "match_id" integer NOT NULL REFERENCES "matches"("id"),
  "player_id" integer NOT NULL REFERENCES "players"("id"),
  "vm_before" integer NOT NULL,
  "vm_after" integer NOT NULL,
  "delta" integer NOT NULL,
  "mvp" double precision NOT NULL,
  "peer" double precision NOT NULL,
  "offensive" double precision NOT NULL,
  "result" double precision NOT NULL,
  "performance_score" double precision NOT NULL,
  "raw_change" double precision NOT NULL,
  "multiplier" double precision NOT NULL,
  "adjusted_contribution" double precision NOT NULL,
  "expected_contribution" double precision NOT NULL,
  "baseline" double precision NOT NULL,
  "own_team_avg_vm" double precision NOT NULL,
  "opp_team_avg_vm" double precision NOT NULL,
  "mvp_votes" integer NOT NULL DEFAULT 0,
  "peer_average" double precision,
  "breakdown" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_market_value_history_match_player" ON "player_market_value_history" ("match_id", "player_id");
